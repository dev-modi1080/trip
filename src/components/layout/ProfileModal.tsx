'use client';

import { useState, useEffect } from 'react';
import { X, User, Phone, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getInitials } from '@/lib/utils';

type ProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ google_drive_refresh_token: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (err) {
      console.error('Error disconnecting Google Drive:', err);
      setError('Failed to disconnect Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            <span className="gradient-text">My Profile</span>
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Avatar Display */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative">
            <div className="avatar h-20 w-20 text-2xl border-4 border-blue-500/20 bg-secondary/50 text-foreground font-bold shadow-xl">
              {profile?.full_name ? getInitials(profile.full_name) : '?'}
            </div>
            {success && (
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg animate-scale-in">
                <Check className="h-4 w-4" />
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground mt-3">{profile?.email}</p>
          <p className="text-xs text-muted-foreground/60">Registered User</p>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger text-center animate-fade-in">
            {error}
          </p>
        )}

        {/* Success */}
        {success && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400 text-center animate-fade-in">
            Profile updated successfully!
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground/50" />
              Full Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-dark text-sm py-2.5"
              placeholder="Enter your name"
              required
              disabled={loading || success}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground/50" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-dark text-sm py-2.5"
              placeholder="e.g. +1 555-0199"
              disabled={loading || success}
            />
          </div>

          {/* Google Drive Connection Info */}
          <div className="pt-2">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Google Drive Backup
            </label>
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${profile?.google_drive_refresh_token ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-xs font-medium text-foreground">
                  {profile?.google_drive_refresh_token ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              {profile?.google_drive_refresh_token ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.auth.signInWithOAuth({
                          provider: 'google',
                          options: {
                            scopes: 'https://www.googleapis.com/auth/drive.file',
                            queryParams: {
                              access_type: 'offline',
                              prompt: 'consent',
                            },
                            redirectTo: window.location.origin + '/auth/callback',
                          }
                        });
                        if (error) throw error;
                      } catch (err) {
                        console.error('Error linking Google Drive:', err);
                      }
                    }}
                    className="text-xs font-semibold text-primary hover:text-blue-600 transition-colors"
                  >
                    Reconnect
                  </button>
                  <span className="text-muted-foreground/30">|</span>
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="text-xs font-semibold text-danger hover:text-red-500 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          scopes: 'https://www.googleapis.com/auth/drive.file',
                          queryParams: {
                            access_type: 'offline',
                            prompt: 'consent',
                          },
                          redirectTo: window.location.origin + '/auth/callback',
                        }
                      });
                      if (error) throw error;
                    } catch (err) {
                      console.error('Error linking Google Drive:', err);
                    }
                  }}
                  className="text-xs font-semibold text-primary hover:text-blue-600 transition-colors"
                >
                  Link Drive
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 text-sm py-2"
              disabled={loading || success}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-glow flex-1 text-sm py-2 flex items-center justify-center gap-2"
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
