import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";

/**
 * createOrganization — Hasura Action handler
 *
 * Security model:
 *   - User identity comes from X-Hasura-User-Id header (set by Nhost/Hasura
 *     from the JWT — the client cannot forge this).
 *   - The client never supplies user_id or role.
 *   - Organization + owner membership are created atomically via a
 *     single GraphQL mutation with admin privileges.
 *   - Uses Hasura GraphQL API (not direct pg) so it works both locally
 *     (pointing at the Nhost cloud DB) and when deployed as an Nhost Function.
 */
export default async function handleCreateOrganization(req: Request, res: Response) {
  try {
    // ── Layer 1: Extract authenticated user from Hasura-injected header ──
    const userId = (
      req.headers["x-hasura-user-id"] ||
      req.body?.session_variables?.["x-hasura-user-id"]
    ) as string;

    if (!userId || userId === "anonymous") {
      return res.status(401).json({
        message: "Unauthorized: Missing authenticated Nhost user identity.",
      });
    }

    // ── Parse org name from body (supports both direct and Action payload) ──
    const orgName = (
      req.body?.input?.name ||
      req.body?.name ||
      ""
    ).trim();

    if (!orgName) {
      return res.status(400).json({ message: "Bad Request: Organization name is required." });
    }

    // ── Atomically create org + owner membership via admin GraphQL ──
    // Using insert_organizations with a nested insert_org_members ensures
    // both records are created in a single transaction. If either fails,
    // neither is committed.
    const result = await graphqlAdmin<{
      insert_organizations_one: {
        id: string;
        name: string;
        created_at: string;
        members: Array<{ id: string; role: string }>;
      };
    }>(
      `mutation CreateOrganizationWithOwner($name: String!, $userId: uuid!) {
        insert_organizations_one(object: {
          name: $name
          quota_allowed: 100
          quota_used: 0
          members: {
            data: [{
              user_id: $userId
              role: "owner"
            }]
          }
        }) {
          id
          name
          created_at
          members {
            id
            role
          }
        }
      }`,
      { name: orgName, userId }
    );

    const newOrg = result.insert_organizations_one;

    return res.status(200).json({
      org_id: newOrg.id,
      name: newOrg.name,
      role: "owner",
      created_at: newOrg.created_at,
    });
  } catch (err: any) {
    console.error("[createOrganization] Error:", err.message || err);
    return res.status(500).json({
      message: err.message || "Internal server error during organization creation.",
    });
  }
}
