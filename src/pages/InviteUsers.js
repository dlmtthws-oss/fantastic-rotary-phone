import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

export default function InviteUsers({ user }) {
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('worker');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');

  async function handleInvite(e) {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      // Create invitation record (company_id stamped explicitly so the
      // invitee joins THIS company when they accept).
      const { data, error: inviteError } = await supabase
        .from('invitations')
        .insert([{
          company_id: companyId,
          email,
          full_name: fullName || null,
          role,
          invited_by: user?.id,
          status: 'pending'
        }])
        .select()
        .single();

      if (inviteError) throw inviteError;

      setInviteLink(`${window.location.origin}/invitation/${data.id}`);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-4">✉️</div>
        <h3 className="text-lg font-semibold mb-2">Invitation Sent!</h3>
        <p className="text-gray-600 mb-4">
          An invitation has been sent to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Role: {role}
        </p>
        <div className="mt-4 p-3 bg-gray-50 rounded text-left">
          <p className="text-xs text-gray-500 mb-1">Share this link so they can set a password and join:</p>
          <code className="block text-xs break-all text-blue-700">{inviteLink}</code>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="mt-4 btn btn-primary"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Invite New User</h3>
      
      <form onSubmit={handleInvite} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="input"
            placeholder="Jane Smith"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input"
            placeholder="colleague@company.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="input"
          >
            <option value="worker">Field Worker</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex-1 btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex-1 btn btn-primary"
          >
            {sending ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </div>
  );
}
