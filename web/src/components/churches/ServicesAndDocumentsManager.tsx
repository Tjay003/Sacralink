import { useCallback, useEffect, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    FileText,
    Loader2,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    createServiceType,
    deleteServiceType,
    getManageableServiceTypes,
    isDuplicateServiceNameError,
    updateServiceType,
    type ServiceType,
} from '../../lib/supabase/serviceTypes';
import {
    createRequirement,
    deleteRequirement,
    getRequirementsForChurch,
    updateRequirement,
} from '../../lib/supabase/requirements';
import type { Database } from '../../types/database';

type Requirement = Database['public']['Tables']['sacrament_requirements']['Row'];

interface ServicesAndDocumentsManagerProps {
    churchId: string;
}

type ServiceForm = { mode: 'add' } | { mode: 'edit'; id: string };
type DocumentForm = { serviceId: string; mode: 'add' } | { serviceId: string; mode: 'edit'; id: string };
type PendingDelete =
    | { kind: 'service'; id: string; hasAppointments: boolean | null }
    | { kind: 'document'; id: string };

const iconButton =
    'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-white text-muted ' +
    'hover:text-foreground hover:bg-secondary-50 transition-colors cursor-pointer disabled:opacity-40 ' +
    'disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-muted';

function messageOf(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message);
    return 'Something went wrong. Please try again.';
}

/**
 * Services & Documents - where a parish office manages the services it offers (add, rename, describe,
 * reorder, hide, delete) and the documents a parishioner must upload for each one. Every change is saved
 * right away; it does not wait for the page's "Save changes" button. Row level security is the real guard:
 * only the parish church admin, admin and super admin can write.
 */
export default function ServicesAndDocumentsManager({ churchId }: ServicesAndDocumentsManagerProps) {
    const [services, setServices] = useState<ServiceType[]>([]);
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [pageError, setPageError] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const [serviceForm, setServiceForm] = useState<ServiceForm | null>(null);
    const [serviceName, setServiceName] = useState('');
    const [serviceDescription, setServiceDescription] = useState('');
    const [serviceFormError, setServiceFormError] = useState('');

    const [documentForm, setDocumentForm] = useState<DocumentForm | null>(null);
    const [documentName, setDocumentName] = useState('');
    const [documentDescription, setDocumentDescription] = useState('');
    const [documentRequired, setDocumentRequired] = useState(true);
    const [documentFormError, setDocumentFormError] = useState('');

    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

    const reload = useCallback(async () => {
        try {
            const [loadedServices, loadedRequirements] = await Promise.all([
                getManageableServiceTypes(churchId),
                getRequirementsForChurch(churchId),
            ]);
            setServices(loadedServices);
            setRequirements(loadedRequirements);
            setPageError('');
        } catch (error) {
            setPageError(messageOf(error));
        } finally {
            setLoading(false);
        }
    }, [churchId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const documentsOf = (serviceId: string) =>
        requirements
            .filter((requirement) => requirement.service_type_id === serviceId)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    /** Runs a write, then refreshes. Errors that are not handled by the caller land in the page alert. */
    async function run(action: () => Promise<void>): Promise<boolean> {
        setBusy(true);
        setPageError('');
        try {
            await action();
            await reload();
            return true;
        } catch (error) {
            setPageError(messageOf(error));
            return false;
        } finally {
            setBusy(false);
        }
    }

    // ── Services ─────────────────────────────────────────────────────────────

    function openServiceForm(form: ServiceForm, service?: ServiceType) {
        setPendingDelete(null);
        setDocumentForm(null);
        setServiceForm(form);
        setServiceName(service?.name ?? '');
        setServiceDescription(service?.description ?? '');
        setServiceFormError('');
    }

    async function saveService() {
        if (!serviceForm) return;
        const name = serviceName.trim();
        if (!name) return;
        const description = serviceDescription.trim() || null;
        setBusy(true);
        setServiceFormError('');
        try {
            if (serviceForm.mode === 'add') {
                await createServiceType(churchId, { name, description });
            } else {
                await updateServiceType(serviceForm.id, { name, description });
            }
            await reload();
            setServiceForm(null);
        } catch (error) {
            if (isDuplicateServiceNameError(error)) {
                setServiceFormError(`A service named "${name}" already exists in this parish. Choose a different name.`);
            } else {
                setServiceFormError(messageOf(error));
            }
        } finally {
            setBusy(false);
        }
    }

    async function moveService(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= services.length) return;
        const reordered = [...services];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setServices(reordered);
        await run(async () => {
            await Promise.all(
                reordered.map((service, position) =>
                    service.display_order === position + 1
                        ? Promise.resolve()
                        : updateServiceType(service.id, { display_order: position + 1 }).then(() => undefined)
                )
            );
        });
    }

    async function toggleHidden(service: ServiceType) {
        await run(async () => {
            await updateServiceType(service.id, { is_hidden: !service.is_hidden });
        });
    }

    async function askDeleteService(service: ServiceType) {
        setServiceForm(null);
        setDocumentForm(null);
        setPendingDelete({ kind: 'service', id: service.id, hasAppointments: null });
        const { count, error } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('service_type_id', service.id);
        // When the count is unknown the database still decides; assume the careful wording
        setPendingDelete((current) =>
            current?.kind === 'service' && current.id === service.id
                ? { kind: 'service', id: service.id, hasAppointments: error ? true : (count ?? 0) > 0 }
                : current
        );
    }

    async function confirmDeleteService(service: ServiceType) {
        const done = await run(async () => {
            await deleteServiceType(service.id);
        });
        if (done) setPendingDelete(null);
    }

    // ── Documents ────────────────────────────────────────────────────────────

    function toggleExpanded(serviceId: string) {
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(serviceId)) next.delete(serviceId);
            else next.add(serviceId);
            return next;
        });
    }

    function openDocumentForm(form: DocumentForm, requirement?: Requirement) {
        setPendingDelete(null);
        setServiceForm(null);
        setDocumentForm(form);
        setDocumentName(requirement?.requirement_name ?? '');
        setDocumentDescription(requirement?.description ?? '');
        setDocumentRequired(requirement ? Boolean(requirement.is_required) : true);
        setDocumentFormError('');
    }

    async function saveDocument(service: ServiceType) {
        if (!documentForm) return;
        const name = documentName.trim();
        if (!name) return;
        const description = documentDescription.trim() || null;
        setBusy(true);
        setDocumentFormError('');
        try {
            if (documentForm.mode === 'add') {
                const existing = documentsOf(service.id);
                const nextOrder = existing.reduce((highest, item) => Math.max(highest, item.display_order ?? 0), 0) + 1;
                await createRequirement({
                    church_id: churchId,
                    service_type_id: service.id,
                    service_type: service.name.toLowerCase(),
                    requirement_name: name,
                    description,
                    is_required: documentRequired,
                    display_order: nextOrder,
                });
            } else {
                await updateRequirement(documentForm.id, {
                    requirement_name: name,
                    description,
                    is_required: documentRequired,
                });
            }
            await reload();
            setDocumentForm(null);
        } catch (error) {
            setDocumentFormError(messageOf(error));
        } finally {
            setBusy(false);
        }
    }

    async function moveDocument(serviceId: string, index: number, direction: -1 | 1) {
        const list = documentsOf(serviceId);
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        const reordered = [...list];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setRequirements((current) => [
            ...current.filter((requirement) => requirement.service_type_id !== serviceId),
            ...reordered.map((requirement, position) => ({ ...requirement, display_order: position + 1 })),
        ]);
        await run(async () => {
            await Promise.all(
                reordered.map((requirement, position) =>
                    requirement.display_order === position + 1
                        ? Promise.resolve()
                        : updateRequirement(requirement.id, { display_order: position + 1 }).then(() => undefined)
                )
            );
        });
    }

    async function confirmDeleteDocument(requirement: Requirement) {
        const done = await run(async () => {
            await deleteRequirement(requirement.id);
        });
        if (done) setPendingDelete(null);
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    /** Enter saves the open mini form instead of submitting the whole Edit Church page. */
    const saveOnEnter = (save: () => void) => (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            save();
        }
    };

    function renderServiceForm(service?: ServiceType) {
        return (
            <div className="space-y-3 p-3 sm:p-4 bg-secondary-50/60">
                <div>
                    <label htmlFor="service-name-input" className="block text-xs font-semibold text-foreground mb-1.5">
                        Service name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="service-name-input"
                        type="text"
                        value={serviceName}
                        onChange={(event) => setServiceName(event.target.value)}
                        onKeyDown={saveOnEnter(() => void saveService())}
                        disabled={busy}
                        placeholder="e.g., First Communion"
                        className="input w-full text-sm"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor="service-description-input" className="block text-xs font-semibold text-foreground mb-1.5">
                        Service description (optional)
                    </label>
                    <textarea
                        id="service-description-input"
                        value={serviceDescription}
                        onChange={(event) => setServiceDescription(event.target.value)}
                        disabled={busy}
                        rows={2}
                        placeholder="Shown under the service on the booking form"
                        className="input w-full text-sm"
                    />
                </div>
                {serviceFormError && (
                    <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {serviceFormError}
                    </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setServiceForm(null)}
                        disabled={busy}
                        className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void saveService()}
                        disabled={busy || !serviceName.trim()}
                        className="btn-primary px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {service ? 'Save service' : 'Create service'}
                    </button>
                </div>
            </div>
        );
    }

    function renderDocumentForm(service: ServiceType) {
        return (
            <div className="space-y-3 rounded-xl border border-border bg-white p-3">
                <div>
                    <label htmlFor={`document-name-${service.id}`} className="block text-xs font-semibold text-foreground mb-1.5">
                        Document name <span className="text-red-500">*</span>
                    </label>
                    <input
                        id={`document-name-${service.id}`}
                        type="text"
                        value={documentName}
                        onChange={(event) => setDocumentName(event.target.value)}
                        onKeyDown={saveOnEnter(() => void saveDocument(service))}
                        disabled={busy}
                        placeholder="e.g., Birth Certificate"
                        className="input w-full text-sm"
                        autoFocus
                    />
                </div>
                <div>
                    <label htmlFor={`document-description-${service.id}`} className="block text-xs font-semibold text-foreground mb-1.5">
                        Document description (optional)
                    </label>
                    <textarea
                        id={`document-description-${service.id}`}
                        value={documentDescription}
                        onChange={(event) => setDocumentDescription(event.target.value)}
                        disabled={busy}
                        rows={2}
                        placeholder="Shown under the document on the booking form"
                        className="input w-full text-sm"
                    />
                </div>
                <div>
                    <span className="block text-xs font-semibold text-foreground mb-1.5">Parishioners must upload it</span>
                    <div className="inline-flex rounded-xl border border-border overflow-hidden">
                        {[
                            { label: 'Required', value: true },
                            { label: 'Optional', value: false },
                        ].map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                aria-pressed={documentRequired === option.value}
                                onClick={() => setDocumentRequired(option.value)}
                                disabled={busy}
                                className={`px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                    documentRequired === option.value
                                        ? 'bg-primary text-white'
                                        : 'bg-white text-foreground hover:bg-secondary-50'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                {documentFormError && (
                    <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {documentFormError}
                    </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setDocumentForm(null)}
                        disabled={busy}
                        className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void saveDocument(service)}
                        disabled={busy || !documentName.trim()}
                        className="btn-primary px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save document
                    </button>
                </div>
            </div>
        );
    }

    function renderDocuments(service: ServiceType) {
        const documents = documentsOf(service.id);
        const addingHere = documentForm?.serviceId === service.id && documentForm.mode === 'add';

        return (
            <div className="border-t border-border bg-secondary-50/40 p-3 sm:p-4 space-y-3">
                {documents.length === 0 && !addingHere && (
                    <p className="text-xs text-muted">
                        No documents yet. Parishioners are not asked to upload anything for this service.
                    </p>
                )}

                {documents.length > 0 && (
                    <ul className="space-y-2">
                        {documents.map((requirement, index) => {
                            const editingThis =
                                documentForm?.serviceId === service.id &&
                                documentForm.mode === 'edit' &&
                                documentForm.id === requirement.id;
                            const deletingThis = pendingDelete?.kind === 'document' && pendingDelete.id === requirement.id;

                            return (
                                <li
                                    key={requirement.id}
                                    data-document-name={requirement.requirement_name}
                                    className="rounded-xl border border-border bg-white p-3"
                                >
                                    {editingThis ? (
                                        renderDocumentForm(service)
                                    ) : (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <FileText className="w-4 h-4 text-muted shrink-0" />
                                                    <span className="text-sm font-semibold text-foreground break-words min-w-0">
                                                        {requirement.requirement_name}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                                            requirement.is_required
                                                                ? 'bg-primary-50 text-primary border-primary-200'
                                                                : 'bg-secondary-50 text-secondary-700 border-border'
                                                        }`}
                                                    >
                                                        {requirement.is_required ? 'Required' : 'Optional'}
                                                    </span>
                                                </div>
                                                {requirement.description && (
                                                    <p className="text-xs text-muted mt-1 break-words">{requirement.description}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    aria-label={`Move ${requirement.requirement_name} up`}
                                                    title="Move up"
                                                    onClick={() => void moveDocument(service.id, index, -1)}
                                                    disabled={busy || index === 0}
                                                    className={iconButton}
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Move ${requirement.requirement_name} down`}
                                                    title="Move down"
                                                    onClick={() => void moveDocument(service.id, index, 1)}
                                                    disabled={busy || index === documents.length - 1}
                                                    className={iconButton}
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Edit ${requirement.requirement_name}`}
                                                    title="Edit"
                                                    onClick={() => openDocumentForm({ serviceId: service.id, mode: 'edit', id: requirement.id }, requirement)}
                                                    disabled={busy}
                                                    className={iconButton}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Delete ${requirement.requirement_name}`}
                                                    title="Delete"
                                                    onClick={() => {
                                                        setServiceForm(null);
                                                        setDocumentForm(null);
                                                        setPendingDelete({ kind: 'document', id: requirement.id });
                                                    }}
                                                    disabled={busy}
                                                    className={iconButton}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {deletingThis && (
                                        <div
                                            role="group"
                                            aria-label={`Confirm delete ${requirement.requirement_name}`}
                                            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2"
                                        >
                                            <p className="text-xs text-red-800">
                                                Remove this document from the checklist? Files parishioners already uploaded stay on their appointments.
                                            </p>
                                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingDelete(null)}
                                                    disabled={busy}
                                                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void confirmDeleteDocument(requirement)}
                                                    disabled={busy}
                                                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                                                >
                                                    Yes, delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                {addingHere ? (
                    renderDocumentForm(service)
                ) : (
                    <button
                        type="button"
                        onClick={() => openDocumentForm({ serviceId: service.id, mode: 'add' })}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add document
                    </button>
                )}
            </div>
        );
    }

    function renderService(service: ServiceType, index: number) {
        const documents = documentsOf(service.id);
        const isOpen = expanded.has(service.id);
        const editingThis = serviceForm?.mode === 'edit' && serviceForm.id === service.id;
        const deletingThis = pendingDelete?.kind === 'service' && pendingDelete.id === service.id;

        return (
            <li key={service.id} data-service-name={service.name} className="rounded-2xl border border-border bg-white overflow-hidden">
                {editingThis ? (
                    renderServiceForm(service)
                ) : (
                    <div className="p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground break-words min-w-0">{service.name}</h3>
                                {service.is_hidden && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700">
                                        <EyeOff className="w-3 h-3" />
                                        Hidden
                                    </span>
                                )}
                            </div>
                            {service.description && <p className="text-xs text-muted mt-1 break-words">{service.description}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                                type="button"
                                aria-label={`Move ${service.name} up`}
                                title="Move up"
                                onClick={() => void moveService(index, -1)}
                                disabled={busy || index === 0}
                                className={iconButton}
                            >
                                <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                aria-label={`Move ${service.name} down`}
                                title="Move down"
                                onClick={() => void moveService(index, 1)}
                                disabled={busy || index === services.length - 1}
                                className={iconButton}
                            >
                                <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                aria-label={`${service.is_hidden ? 'Show' : 'Hide'} ${service.name}`}
                                title={service.is_hidden ? 'Show on the booking form' : 'Hide from the booking form'}
                                onClick={() => void toggleHidden(service)}
                                disabled={busy}
                                className={iconButton}
                            >
                                {service.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                aria-label={`Edit ${service.name}`}
                                title="Rename or describe"
                                onClick={() => openServiceForm({ mode: 'edit', id: service.id }, service)}
                                disabled={busy}
                                className={iconButton}
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                aria-label={`Delete ${service.name}`}
                                title="Delete"
                                onClick={() => void askDeleteService(service)}
                                disabled={busy}
                                className={iconButton}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {deletingThis && (
                    <div
                        role="group"
                        aria-label={`Confirm delete ${service.name}`}
                        className="mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2"
                    >
                        <p className="text-xs text-red-800">
                            {pendingDelete.kind === 'service' && pendingDelete.hasAppointments === null
                                ? 'Checking the parish appointments...'
                                : pendingDelete.kind === 'service' && pendingDelete.hasAppointments
                                  ? 'Existing appointments keep this service; it will no longer be offered.'
                                  : 'No appointment uses this service, so it will be removed permanently together with its documents.'}
                        </p>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingDelete(null)}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDeleteService(service)}
                                disabled={busy || (pendingDelete.kind === 'service' && pendingDelete.hasAppointments === null)}
                                className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
                            >
                                Yes, delete
                            </button>
                        </div>
                    </div>
                )}

                <div className="border-t border-border">
                    <button
                        type="button"
                        aria-label={`Documents for ${service.name}`}
                        aria-expanded={isOpen}
                        onClick={() => toggleExpanded(service.id)}
                        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors cursor-pointer text-left"
                    >
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                        <span>Documents ({documents.length})</span>
                    </button>
                    {isOpen && renderDocuments(service)}
                </div>
            </li>
        );
    }

    const addingService = serviceForm?.mode === 'add';

    return (
        <div data-testid="services-documents" className="card p-6 bg-white border border-border rounded-2xl shadow-xs space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">Services &amp; Documents</h2>
                    <p className="text-xs text-muted mt-0.5">
                        The services your parish offers and the documents parishioners upload when booking them. Changes here
                        are saved right away.
                    </p>
                </div>
                {!addingService && (
                    <button
                        type="button"
                        onClick={() => openServiceForm({ mode: 'add' })}
                        disabled={busy}
                        className="btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add service
                    </button>
                )}
            </div>

            {pageError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-800 break-words">
                    {pageError}
                </div>
            )}

            {addingService && (
                <div className="rounded-2xl border border-border overflow-hidden">{renderServiceForm()}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading services...
                </div>
            ) : services.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-border text-xs text-muted">
                    No services yet. Add the first one to let parishioners book it.
                </div>
            ) : (
                <ul className="space-y-3">{services.map((service, index) => renderService(service, index))}</ul>
            )}
        </div>
    );
}
