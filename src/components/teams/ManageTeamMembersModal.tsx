--- a/src/components/teams/ManageTeamMembersModal.tsx
+++ b/src/components/teams/ManageTeamMembersModal.tsx
@@ -2,6 +2,7 @@
 import {
   X,
   Mail,
+  Loader2,
   UserPlus,
   UserMinus,
   AlertCircle,
@@ -9,7 +10,8 @@
   Clock,
   RefreshCw,
   XCircle,
-  CheckCircle,
+  CheckCircle,
   Info
 } from 'lucide-react';
 import { supabase } from '../../lib/supabase';
+import UserDirectoryTab from './UserDirectoryTab';
 import { useTeams } from '../../contexts/TeamsContext';
 import { sendTeamInvitationEmail } from '../../lib/email';
 import { useAuth } from '../../contexts/AuthContext';
@@ -125,7 +127,8 @@ export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMember
           {testEmailResult && (
             <div className="mb-4 p-3 rounded-lg bg-gray-50">
               <h4 className="font-medium text-gray-900 mb-2">Test Email Results</h4>
-              <pre className="text-xs text-gray-600 overflow-x-auto max-h-40 p-2 bg-gray-100 rounded">
+              <pre className="text-xs text-gray-600 overflow-x-auto max-h-40 p-2 bg-gray-100 rounded">
                 {JSON.stringify(testEmailResult, null, 2)}
               </pre>
             </div>
@@ -133,7 +136,42 @@ export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMember
 
           {/* Email Tab */}
           {activeTab === 'email' && (
-            <div className="space-y-4">{/* restored below */}</div>
+            <form onSubmit={handleEmailInvite} className="space-y-4">
+              {/* Team Role */}
+              <div className="mb-4">
+                <label className="block text-sm font-medium text-gray-700 mb-1">
+                  Team Role
+                </label>
+                <select
+                  value={teamRole}
+                  onChange={e => setTeamRole(e.target.value as TeamRole)}
+                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
+                >
+                  {TEAM_ROLES.map(r => (
+                    <option key={r.id} value={r.id}>
+                      {r.label} – {r.description}
+                    </option>
+                  ))}
+                </select>
+              </div>
+
+              {/* Decision Role */}
+              <div className="mb-4">
+                <label className="block text-sm font-medium text-gray-700 mb-1">
+                  Decision Role
+                </label>
+                <select
+                  value={decisionRole}
+                  onChange={e => setDecisionRole(e.target.value as DecisionRole)}
+                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
+                >
+                  {DECISION_ROLES.map(r => (
+                    <option key={r.id} value={r.id}>
+                      {r.label} – {r.description}
+                    </option>
+                  ))}
+                </select>
+              </div>
+
+              {/* Emails */}
+              <div>
+                <label className="block text-sm font-medium text-gray-700 mb-1">
+                  Email Addresses
+                </label>
+                <textarea
+                  value={emails}
+                  onChange={e => setEmails(e.target.value)}
+                  placeholder="Enter email addresses (one per line or comma-separated)"
+                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
+                  rows={4}
+                />
+              </div>
+
+              <button
+                type="submit"
+                disabled={loading || !emails.trim()}
+                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
+              >
+                {loading ? (
+                  <>
+                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
+                    Adding…
+                  </>
+                ) : (
+                  <>
+                    <UserPlus className="h-5 w-5 mr-2" />
+                    Add Members
+                  </>
+                )}
+              </button>
+            </form>
           )}
 
           {/* Directory Tab */}
@@ -142,7 +180,15 @@ export default function ManageTeamMembersModal({ team, onClose }: ManageTeamMember
           {activeTab === 'directory' && (
-            <div>{/* restored below */}</div>
+            <UserDirectoryTab onAddUser={handleAddFromDirectory} />
           )}
 
           {/* Pending Invitations */}
+          {activeTab === 'pending' && (
+            <div className="space-y-4">
+              {loadingInvitations ? (
+                <div className="flex items-center justify-center p-8">
+                  <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
+                  <span className="text-gray-600">Loading invitations…</span>
+                </div>
+              ) : invitations.length === 0 ? (
+                <div className="text-center py-8 text-gray-500">
+                  <p>No pending invitations</p>
+                </div>
+              ) : (
+                invitations.map(inv => (
+                  <div
+                    key={inv.id}
+                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
+                  >
+                    <div>
+                      <div className="font-medium text-gray-900">{inv.email}</div>
+                      <div className="text-xs text-gray-500 mt-1">
+                        <span className="inline-flex items-center">
+                          <Clock className="h-3 w-3 mr-1" />
+                          Invited {new Date(inv.invited_at).toLocaleString()}
+                        </span>
+                      </div>
+                    </div>
+                    <div className="flex gap-2">
+                      <Tooltip content="View logs">
+                        <button
+                          onClick={(e) => {
+                            e.stopPropagation();
+                            viewInvitationLogs(inv);
+                          }}
+                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
+                        >
+                          <Info className="h-4 w-4" />
+                        </button>
+                      </Tooltip>
+                      <Tooltip content="Resend">
+                        <button
+                          disabled={processingInvitationId === inv.id}
+                          onClick={(e) => {
+                            e.stopPropagation();
+                            handleResendInvitation(inv.id);
+                          }}
+                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded disabled:opacity-50"
+                        >
+                          {processingInvitationId === inv.id ? (
+                            <Loader2 className="h-4 w-4 animate-spin" />
+                          ) : (
+                            <RefreshCw className="h-4 w-4" />
+                          )}
+                        </button>
+                      </Tooltip>
+                      <Tooltip content="Revoke">
+                        <button
+                          disabled={processingInvitationId === inv.id}
+                          onClick={(e) => {
+                            e.stopPropagation();
+                            handleRevokeInvitation(inv.id);
+                          }}
+                          className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
+                        >
+                          {processingInvitationId === inv.id ? (
+                            <Loader2 className="h-4 w-4 animate-spin" />
+                          ) : (
+                            <XCircle className="h-4 w-4" />
+                          )}
+                        </button>
+                      </Tooltip>
+                    </div>
+                  </div>
+                ))
+              )}
+            </div>
+          )}
 
           {/* Invitation Logs Modal */}
           {selectedInvitation && (