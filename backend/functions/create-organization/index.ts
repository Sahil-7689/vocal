import { Request, Response } from "express";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleCreateOrganization(req: Request, res: Response) {
  try {
    // 1. Authenticate user from Hasura / Nhost header
    const userId = (req.headers["x-hasura-user-id"] || req.body?.session_variables?.["x-hasura-user-id"]) as string;
    
    if (!userId || userId === "anonymous") {
      return res.status(401).json({
        message: "Unauthorized: Missing authenticated Nhost user header",
      });
    }

    // 2. Parse Organization Name from request body (supports direct body or Hasura Action payload)
    const orgName = (req.body.name || req.body?.input?.name || "").trim();

    if (!orgName) {
      return res.status(400).json({
        message: "Organization name is required",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 3. Insert new Organization record
      const orgRes = await client.query(
        `INSERT INTO public.organizations (name, quota_allowed, quota_used)
         VALUES ($1, $2, $3)
         RETURNING id, name, quota_allowed, quota_used, created_at`,
        [orgName, 10000, 0]
      );

      const newOrg = orgRes.rows[0];

      // 4. Atomically insert authenticated user as OWNER in org_members
      const memberRes = await client.query(
        `INSERT INTO public.org_members (org_id, user_id, role)
         VALUES ($1, $2, 'owner')
         RETURNING id, org_id, user_id, role, created_at`,
        [newOrg.id, userId]
      );

      const newMember = memberRes.rows[0];

      await client.query("COMMIT");

      return res.status(200).json({
        org_id: newOrg.id,
        name: newOrg.name,
        user_id: userId,
        role: "owner",
        created_at: newOrg.created_at,
      });
    } catch (dbErr: any) {
      await client.query("ROLLBACK");
      console.error("Database error creating organization:", dbErr);
      return res.status(500).json({
        message: "Failed to create organization in database",
        error: dbErr.message,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Unexpected error in create-organization:", err);
    return res.status(500).json({
      message: "Internal server error during organization creation",
      error: err.message,
    });
  }
}
