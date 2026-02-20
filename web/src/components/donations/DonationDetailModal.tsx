import { useState } from 'react';
import { X, CheckCircle, XCircle, User, Hash, Calendar, Eye } from 'lucide-react';
import { verifyDonation, rejectDonation, type Donation } from '../../lib/supabase/donations';
import { formatDistanceToNow } from 'date-fns';

interface DonationDetailModalProps {
    donation: Donation;
    onClose: () => void;
    onUpdated: () => void;
}

export default function DonationDetailModal({ donation, onClose, onUpdated }: DonationDetailModalProps) {
    const [loading, setLoading] = useState(false);
    const [rejectionNote, setRejectionNote] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [error, setError] = useState('');
    const [fullImage, setFullImage] = useState(false);

    const donorName = (donation.donor as any)?.full_name || 'Anonymous';
    const donorEmail = (donation.donor as any)?.email || '';

    const handleVerify = async () => {
        setLoading(true);
        setError('');
        const { error: err } = await verifyDonation(donation.id);
        if (err) {
            setError(err.message || 'Failed to verify donation');
            setLoading(false);
            return;
        }
        onUpdated();
        onClose();
    };

    const handleReject = async () => {
        if (!rejectionNote.trim()) {
            setError('Please provide a reason for rejection');
            return;
        }
        setLoading(true);
        setError('');
        const { error: err } = await rejectDonation(donation.id, rejectionNote);
        if (err) {
            setError(err.message || 'Failed to reject donation');
            setLoading(false);
            return;
        }
        onUpdated();
        onClose();
    };

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-700',
        verified: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <h2 className="text-lg font-bold">Donation Details</h2>
                        <button onClick={onClose} className="text-muted hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Status badge */}
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[donation.status || 'pending']}`}>
                            <span className="capitalize">{donation.status}</span>
                        </div>

                        {/* Donor info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-muted">
                                    <User className="w-3 h-3" />
                                    Donor
                                </div>
                                <p className="font-semibold">{donorName}</p>
                                <p className="text-xs text-muted">{donorEmail}</p>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs text-muted">
                                    <Calendar className="w-3 h-3" />
                                    Submitted
                                </div>
                                <p className="font-semibold">
                                    {donation.created_at
                                        ? formatDistanceToNow(new Date(donation.created_at), { addSuffix: true })
                                        : 'Unknown'}
                                </p>
                            </div>
                        </div>

                        {/* Amount + Reference */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-primary/5 rounded-xl">
                                <p className="text-xs text-muted mb-1">Amount</p>
                                <p className="text-2xl font-bold text-primary">
                                    ₱{Number(donation.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="p-4 bg-muted/10 rounded-xl">
                                <div className="flex items-center gap-1 text-xs text-muted mb-1">
                                    <Hash className="w-3 h-3" />
                                    Reference No.
                                </div>
                                <p className="font-mono font-semibold text-sm break-all">
                                    {donation.reference_number || 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Proof Screenshot */}
                        {donation.proof_url && (
                            <div>
                                <p className="text-sm font-medium mb-2">Payment Proof</p>
                                <div className="relative">
                                    <img
                                        src={donation.proof_url}
                                        alt="Payment proof"
                                        className={`w-full rounded-xl border border-border object-contain bg-muted/10 cursor-pointer transition-all ${fullImage ? 'max-h-[500px]' : 'max-h-48'
                                            }`}
                                        onClick={() => setFullImage(!fullImage)}
                                    />
                                    <button
                                        onClick={() => setFullImage(!fullImage)}
                                        className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                                    >
                                        <Eye className="w-3 h-3" />
                                        {fullImage ? 'Collapse' : 'View Full'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Rejection note if rejected */}
                        {donation.status === 'rejected' && donation.notes && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs font-medium text-red-700 mb-1">Rejection Reason</p>
                                <p className="text-sm text-red-600">{donation.notes}</p>
                            </div>
                        )}

                        {/* Reject form */}
                        {showRejectForm && (
                            <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-sm font-medium text-red-700">Reason for Rejection</p>
                                <textarea
                                    value={rejectionNote}
                                    onChange={(e) => setRejectionNote(e.target.value)}
                                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                                    placeholder="e.g., Reference number doesn't match, screenshot unclear..."
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowRejectForm(false)}
                                        className="flex-1 py-2 text-sm rounded-lg border border-border"
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        className="flex-1 py-2 text-sm rounded-lg bg-red-600 text-white font-medium"
                                        disabled={loading}
                                    >
                                        {loading ? 'Rejecting...' : 'Confirm Reject'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        {donation.status === 'pending' && !showRejectForm && (
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowRejectForm(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors"
                                    disabled={loading}
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                </button>
                                <button
                                    onClick={handleVerify}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                                    disabled={loading}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {loading ? 'Verifying...' : 'Verify'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
