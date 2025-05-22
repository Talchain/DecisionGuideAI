// src/components/teams/ManageTeamMembersModal.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useTeams } from "../../contexts/TeamsContext";
import { useAuth } from "../../contexts/AuthContext";
import { sendInviteViaEdge } from "../../lib/email";
import type { Invitation, InviteResult } from "../../types/invitations";

interface Props {
  onClose: () => void;
}

export default function ManageTeamMembersModal({ onClose }: Props) {
  const { team, invitations: rawInvitations, fetchInvitations, inviteTeamMember } = useTeams();
  const invitations: Invitation[] = rawInvitations || [];  // ← default to []
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [teamRole, setTeamRole] = useState<"member" | "admin">("member");
  const [decisionRole, setDecisionRole] = useState<"contributor" | "owner">("contributor");

  useEffect(() => {
    // clear banners when opening
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
  }, []);

  // Invite new emails
  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const list = emailInput.split(/[\s,;]+/).filter((e) => e);
    for (const email of list) {
      try {
        const result = await inviteTeamMember(team.id, email, teamRole, decisionRole);
        if (result.status === "invited") {
          setSuccessMessage(`Invitation sent to ${email}`);
        } else if (result.status === "already_invited") {
          setInfoMessage(`${email} is already invited`);
        }
      } catch (err: any) {
        console.error("Error inviting via TeamsContext:", err);
        setError(err.message || "Failed to invite");
      }
    }

    setLoading(false);
    setEmailInput("");
    await fetchInvitations();
  };

  // Resend existing invite
  const handleResendInvitation = async (invId: string) => {
    setProcessingInvitationId(invId);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const inv = invitations.find((i) => i.id === invId);
    if (!inv) {
      setError("Invitation not found");
      setProcessingInvitationId(null);
      return;
    }

    try {
      let edgeResult: { success: boolean; error?: string; status?: number };
      if (import.meta.env.VITE_USE_EDGE_INVITES === "true") {
        edgeResult = await sendInviteViaEdge({
          invitation_id: invId,
          email:         inv.email,
          team_id:       team.id,
          team_name:     team.name,
          inviter_id:    user!.id,
        });
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          "send_team_invitation_email",
          {
            invitation_uuid: invId,
            to_email:        inv.email,
            team_name:       team.name,
            inviter_name:    user!.email || "Team Admin",
          }
        );
        edgeResult = data || { success: false, error: rpcError?.message };
      }

      if (edgeResult.success) {
        setSuccessMessage(`Invitation resent to ${inv.email}`);
      } else {
        throw new Error(edgeResult.error || "Failed to resend");
      }
    } catch (err: any) {
      console.error("Error resending invite:", err);
      setError(err.message || "Resend failed");
    }

    setProcessingInvitationId(null);
    await fetchInvitations();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Manage Team Members</h2>

          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded">{error}</div>
          )}
          {successMessage && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded">
              {successMessage}
            </div>
          )}
          {infoMessage && (
            <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleEmailInvite} className="space-y-4 mb-6">
            <label className="block">
              <span className="text-sm font-medium">Invite by email</span>
              <input
                type="text"
                className="mt-1 block w-full border rounded p-2"
                placeholder="alice@example.com, bob@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={loading}
              />
            </label>
            <div className="flex space-x-4">
              <label className="flex-1 block">
                <span className="text-sm font-medium">Role</span>
                <select
                  className="mt-1 block w-full border rounded p-2"
                  value={teamRole}
                  onChange={(e) => setTeamRole(e.target.value as any)}
                  disabled={loading}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex-1 block">
                <span className="text-sm font-medium">Decision Role</span>
                <select
                  className="mt-1 block w-full border rounded p-2"
                  value={decisionRole}
                  onChange={(e) => setDecisionRole(e.target.value as any)}
                  disabled={loading}
                >
                  <option value="contributor">Contributor</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send Invitations"}
            </button>
          </form>

          <div>
            <h3 className="text-lg font-medium mb-2">Pending Invitations</h3>
            <ul className="space-y-2">
              {invitations.length > 0 ? (
                invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between">
                    <span>{inv.email}</span>
                    <button
                      onClick={() => handleResendInvitation(inv.id)}
                      disabled={processingInvitationId === inv.id}
                      className="text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {processingInvitationId === inv.id ? "Resending…" : "Resend"}
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">No pending invites</li>
              )}
            </ul>
          </div>

          <div className="mt-6 text-right">
            <button onClick={onClose} className="px-4 py-2 rounded border">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}