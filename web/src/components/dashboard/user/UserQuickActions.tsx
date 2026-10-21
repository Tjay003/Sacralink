import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Video } from 'lucide-react';

interface UserQuickActionsProps {
    churchId?: string | null;
}

export default function UserQuickActions({ churchId }: UserQuickActionsProps) {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Book a sacrament */}
            <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="relative overflow-hidden bg-white border border-border rounded-2xl p-5 shadow-xs text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group flex flex-col justify-between cursor-pointer"
            >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10 w-full flex flex-col justify-between h-full">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-primary flex items-center justify-center mb-3 group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base text-foreground group-hover:text-white transition-colors duration-300">
                            Book a sacrament
                        </h3>
                        <p className="text-xs text-muted mt-1 leading-relaxed group-hover:text-blue-100 transition-colors duration-300 font-medium">
                            Baptism, wedding, blessing and more
                        </p>
                    </div>
                </div>
            </button>

            {/* Mass and confession times */}
            <button
                type="button"
                onClick={() => churchId ? navigate(`/churches/${churchId}`) : navigate('/churches')}
                className="relative overflow-hidden bg-white border border-border rounded-2xl p-5 shadow-xs text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group flex flex-col justify-between cursor-pointer"
            >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10 w-full flex flex-col justify-between h-full">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                        <Clock className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base text-foreground group-hover:text-white transition-colors duration-300">
                            Mass and confession times
                        </h3>
                        <p className="text-xs text-muted mt-1 leading-relaxed group-hover:text-emerald-100 transition-colors duration-300 font-medium">
                            See the parish schedule
                        </p>
                    </div>
                </div>
            </button>

            {/* Watch Mass online */}
            <button
                type="button"
                onClick={() => churchId ? navigate(`/churches/${churchId}`) : navigate('/churches')}
                className="relative overflow-hidden bg-white border border-border rounded-2xl p-5 shadow-xs text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group flex flex-col justify-between cursor-pointer"
            >
                {/* Hover Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10 w-full flex flex-col justify-between h-full">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-white/20 group-hover:text-white transition-all duration-300">
                        <Video className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base text-foreground group-hover:text-white transition-colors duration-300">
                            Watch Mass online
                        </h3>
                        <p className="text-xs text-muted mt-1 leading-relaxed group-hover:text-indigo-100 transition-colors duration-300 font-medium">
                            Join from home
                        </p>
                    </div>
                </div>
            </button>
        </div>
    );
}
