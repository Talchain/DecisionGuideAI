// src/components/teams/ManageTeamMembersModal.tsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useTeams } from "../../contexts/TeamsContext";
import { useAuth } from "../../contexts/AuthContext";
import { sendInviteViaEdge } from "../../lib/email";
import type { Invitation, InviteResult } from "../../types/invitations";

type Tab = "members" | "invitations";

interface Props {
  onClose: () => void;
}

export default function ManageTeamMembersModal({ onClose }: Props) {
  const { team, members: rawMembers, invitations: rawInvitations, fetchInvitations, inviteTeamMember, removeTeamMember } = useTeams();
  const members = rawMembers || [];
  const invitations: Invitation[] = rawInvitations || [];
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [teamRole, setTeamRole] = useState<"member" | "admin">("member");
  const [decisionRole, setDecisionRole] = useState<"contributor" | "owner">("contributor");

  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
  }, [activeTab]);

  // Invite new emails
  const handleEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const list = emailInput.split(/[\s,;]+/).filter(Boolean);
    for (const email of list) {
      try {
        const result = await inviteTeamMember(team.id, email, teamRole, decisionRole);
        if (result.status === "invited") {
          setSuccessMessage(`Invitation sent to ${email}`);
        } else if (result.status === "already_invited") {
          setInfoMessage(`${email} is already invited`);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to invite");
      }
    }

    setLoading(false);
    setEmailInput("");
    await fetchInvitations();
  };

  // Resend an invitation
  const handleResendInvitation = async (invId: string) => {
    setProcessingId(invId);
    setError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    const inv = invitations.find((i) => i.id === invId);
    if (!inv) {
      setError("Invitation not found");
      setProcessingId(null);
      return;
    }

    try {
      let result;
      if (import.meta.env.VITE_USE_EDGE_INVITES === "true") {
        result = await sendInviteViaEdge({
          invitation_id: invId,
          email: inv.email,
          team_id: team.id,
          team_name: team.name,
          inviter_id: user!.id,
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
        result = data || { success: false, error: rpcError?.message };
      }

      if (result.success) {
        setSuccessMessage(`Invitation resent to ${inv.email}`);
      } else {
        throw new Error(result.error || "Resend failed");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to resend");
    }

    setProcessingId(null);
    await fetchInvitations();
  };

  // Remove a team member
  const handleRemoveMember = async (memberId: string) => {
    setProcessingId(memberId);
    setError(null);
    setSuccessMessage(null);

    try {
      await removeTeamMember(team.id, memberId);
      setSuccessMessage("Member removed");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to remove");
    }

    setProcessingId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Manage Team Members</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <nav className="flex space-x-4">
            <button
              className={`pb-2 ${activeTab === "members" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-600"}`}
              onClick={() => setActiveTab("members")}
            >
              Members ({members.length})
            </button>
            <button
              className={`pb-2 ${activeTab === "invitations" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-600"}`}
              onClick={() => setActiveTab("invitations")}
            >
              Invitations ({invitations.length})
            </button>
          </nav>
        </div>

        {/* Banners */}
        <div className="px-6 pt-4">
          {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded">{error}</div>}
          {successMessage && <div className="mb-4 bg-green-50 text-green-700 p-3 rounded">{successMessage}</div>}
          {infoMessage && <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded">{infoMessage}</div>}
        </div>

        {/* Tab content */}
        <div className="px-6 pb-6">
          {activeTab === "members" && (
            <ul className="space-y-2">
              {members.length > 0 ? (
                members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between border-b py-2">
                    <div>
                      <span className="font-medium">{m.user.email}</span>
                      <span className="ml-2 text-sm text-gray-500">({m.role})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={processingId === m.id}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      {processingId === m.id ? "Removing…" : "Remove"}
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-gray-500">No members yet</li>
              )}
            </ul>
          )}

          {activeTab === "invitations" && (
            <>
              {/* Invite form */}
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

              {/* Pending */}
              <h3 className="text-lg font-medium mb-2">Pending Invitations</h3>
              <ul className="space-y-2">
                {invitations.length > 0 ? (
                  invitations.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between border-b py-2">
                      <span>{inv.email}</span>
                      <button
                        onClick={() => handleResendInvitation(inv.id)}
                        disabled={processingId === inv.id}
                        className="text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {processingId === inv.id ? "Resending…" : "Resend"}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">No pending invites</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}