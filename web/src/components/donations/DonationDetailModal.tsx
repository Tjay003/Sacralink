import { useState } from 'react';
import Modal from '../ui/Modal';
import { CheckCircle, XCircle, User, Hash, Calendar, Eye, Heart } from 'lucide-react';
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

    const donorName = donation.donor?.full_name || 'Anonymous';
    const donorEmail = donation.donor?.email || '';

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
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Heart className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Donation Details</h2>
                        <p className="text-xs text-muted">Reference: {donation.reference_number || 'N/A'}</p>
                    </div>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
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
                            <User className="w-3.5 h-3.5" />
                            Donor
                        </div>
                        <p className="text-sm font-semibold text-foreground">{donorName}</p>
                        {donorEmail && <p className="text-xs text-muted">{donorEmail}</p>}
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                            <Calendar className="w-3.5 h-3.5" />
                            Submitted
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                            {donation.created_at
                                ? formatDistanceToNow(new Date(donation.created_at), { addSuffix: true })
                                : 'Recently'}
                        </p>
                    </div>
                </div>

                {/* Church info */}
                {donation.church?.name && (
                    <div className="space-y-1">
                        <p className="text-xs text-muted">Church</p>
                        <p className="text-sm font-medium text-foreground">{donation.church.name}</p>
                    </div>
                )}

                {/* Amount & Reference */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/10 rounded-xl">
                    <div>
                        <p className="text-xs text-muted mb-0.5">Amount</p>
                        <p className="text-2xl font-bold text-foreground">
                            ₱{Number(donation.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted mb-0.5">Reference No.</p>
                        <p className="text-sm font-mono font-semibold text-foreground flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-muted" />
                            {donation.reference_number || 'N/A'}
                        </p>
                        {donation.payment_method && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs uppercase font-medium">
                                {donation.payment_method}
                            </span>
                        )}
                    </div>
                </div>

                {/* Supporter opt-in indicator */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                    donation.show_as_supporter
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-muted/10 text-muted'
                }`}>
                    <Heart className={`w-4 h-4 flex-shrink-0 ${donation.show_as_supporter ? 'fill-rose-400 text-rose-400' : ''}`} />
                    {donation.show_as_supporter
                        ? 'Donor opted in to appear as a supporter'
                        : 'Donor preferred to remain anonymous'}
                </div>

                {/* Notes */}
                {donation.notes && (
                    <div className="space-y-1">
                        <p className="text-xs text-muted">Donor's Note</p>
                        <p className="text-sm text-foreground bg-muted/10 p-3 rounded-lg italic">
                            "{donation.notes}"
                        </p>
                    </div>
                )}

                {/* Proof Screenshot */}
                {donation.proof_url && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted font-medium">Proof of Payment</p>
                        <div className="relative rounded-xl overflow-hidden border border-border bg-black/5">
                            <img
                                src={donation.proof_url}
                                alt="Proof of payment"
                                className="w-full max-h-64 object-contain cursor-pointer"
                                onClick={() => setFullImage(true)}
                            />
                            <button
                                onClick={() => setFullImage(true)}
                                className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs transition-colors backdrop-blur-sm"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                View Full
                            </button>
                        </div>
                    </div>
                )}

                {/* Full Image Modal */}
                {fullImage && donation.proof_url && (
                    <Modal
                        isOpen={fullImage}
                        onClose={() => setFullImage(false)}
                        title="Proof of Payment"
                        size="full"
                    >
                        <div className="flex items-center justify-center p-4">
                            <img
                                src={donation.proof_url}
                                alt="Proof of payment full"
                                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    </Modal>
                )}

                {/* Rejection Note Display */}
                {donation.status === 'rejected' && (donation.rejection_reason || donation.notes) && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                        <p className="font-medium text-red-800 mb-1">Rejection Reason:</p>
                        <p className="text-red-700">{donation.rejection_reason || donation.notes}</p>
                    </div>
                )}

                {/* Reject Form */}
                {showRejectForm && (
                    <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl animate-in">
                        <p className="text-sm font-medium text-red-800">Reason for rejection:</p>
                        <textarea
                            value={rejectionNote}
                            onChange={(e) => setRejectionNote(e.target.value)}
                            placeholder="e.g., Reference number not found, incorrect amount..."
                            rows={3}
                            className="input w-full bg-white text-sm"
                            disabled={loading}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowRejectForm(false)}
                                className="flex-1 py-2 text-sm rounded-lg border border-border bg-white"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                className="flex-1 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
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
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300 text-red-600 font-medium hover:bg-red-50 transition-colors shadow-sm"
                            disabled={loading}
                        >
                            <XCircle className="w-4 h-4" />
                            Reject
                        </button>
                        <button
                            onClick={handleVerify}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors shadow-sm"
                            disabled={loading}
                        >
                            <CheckCircle className="w-4 h-4" />
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
