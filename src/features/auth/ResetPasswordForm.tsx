/**
 * Reset password form component
 * Handles both requesting reset email and setting new password
 */
import { useState, useEffect } from'react';
import { resetPasswordForEmail, updateUserPassword } from'./useSupabaseAuth';
import AuthLoading from'./AuthLoading';

interface ResetPasswordFormProps {
 onSwitchToSignIn: () => void;
 onSuccess: () => void;
}

export default function ResetPasswordForm({
 onSwitchToSignIn,
 onSuccess,
}: ResetPasswordFormProps) {
 const [mode, setMode] = useState<'request' |'set-new'>('request');
 const [email, setEmail] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [emailSent, setEmailSent] = useState(false);
 const [isLoading, setIsLoading] = useState(false);

 // Check if we're in password reset mode (recovery link clicked)
 useEffect(() => {
 const urlParams = new URLSearchParams(window.location.search);
 const hashParams = new URLSearchParams(window.location.hash.substring(1));
 
 const isRecovery = urlParams.get('type') ==='recovery' || 
 hashParams.get('type') ==='recovery' ||
 window.location.search.includes('type=recovery') ||
 window.location.hash.includes('type=recovery');
 
 if (isRecovery) {
 setMode('set-new');
 }
 }, []);

 async function handleRequestReset(e: React.FormEvent) {
 e.preventDefault();
 setError(null);
 
 if (!email.trim()) {
 setError('Please enter your email address');
 return;
 }
 
 setIsLoading(true);
 
 try {
 await resetPasswordForEmail(email);
 setEmailSent(true);
 setIsLoading(false);
 } catch (err: any) {
 const message = err?.message ||'Failed to send reset email';
 setError(message);
 setIsLoading(false);
 }
 }

 async function handleSetNewPassword(e: React.FormEvent) {
 e.preventDefault();
 setError(null);
 
 if (newPassword !== confirmPassword) {
 setError('Passwords do not match');
 return;
 }
 
 if (newPassword.length < 6) {
 setError('Password must be at least 6 characters');
 return;
 }
 
 setIsLoading(true);
 
 try {
 await updateUserPassword(newPassword);
 onSuccess();
 } catch (err: any) {
 const message = err?.message ||'Failed to update password';
 setError(message);
 setIsLoading(false);
 }
 }
 
 // Show loading screen during auth
 if (isLoading) {
 return <AuthLoading />;
 }

 // Email sent confirmation
 if (emailSent) {
 return (
 <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
 <h1 className="text-2xl font-semibold text-slate-900 mb-4">Check Your Email</h1>
 <p className="text-slate-600 mb-2">
 We've sent a password reset link to <strong>{email}</strong>
 </p>
 <p className="text-sm text-slate-500 mb-6">
 Click the link in your email to reset your password.
 </p>
 <button
 type="button"
 onClick={() => {
 setEmailSent(false);
 onSwitchToSignIn();
 }}
 className="text-[#1C8376] text-sm"
 >
 Back to sign in
 </button>
 </div>);
 }

 // Set new password form
 if (mode ==='set-new') {
 return (
 <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
 <h1 className="text-2xl font-semibold text-slate-900 mb-8">Set New Password</h1>
 
 <form onSubmit={handleSetNewPassword} className="space-y-4">
 <div>
 <input
 type="password"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder="New password"
 className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
 required
 autoComplete="new-password"
 minLength={6}
 />
 </div>
 
 <div>
 <input
 type="password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 placeholder="Confirm new password"
 className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
 required
 autoComplete="new-password"
 />
 </div>
 
 {error && (
 <p className="text-sm text-red-600">{error}</p>)}
 
 <button
 type="submit"
 className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full"
 >
 Update Password
 </button>
 </form>
 </div>);
 }

 // Request reset email form
 return (
 <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
 <h1 className="text-2xl font-semibold text-slate-900 mb-8">Reset your password</h1>
 
 <form onSubmit={handleRequestReset} className="space-y-4">
 <div>
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="Email address"
 className="w-full px-4 py-3 border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[#1C8376] focus:border-transparent"
 required
 autoComplete="email"
 />
 </div>
 
 {error && (
 <p className="text-sm text-red-600">{error}</p>)}
 
 <button
 type="submit"
 className="w-full py-3 bg-[#1C8376] text-white font-semibold rounded-full"
 >
 Send reset link
 </button>
 </form>
 
 <div className="mt-6 text-center">
 <p className="text-sm text-slate-500">
 Remember your password?{''}
 <button 
 type="button"
 onClick={onSwitchToSignIn}
 className="text-[#1C8376]"
 >
 Sign in
 </button>
 </p>
 </div>
 </div>);
}
