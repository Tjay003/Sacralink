import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background p-8 md:p-16 flex justify-center">
            <div className="max-w-3xl w-full space-y-8">
                <div className="mb-8">
                    <Link to="/login" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Login
                    </Link>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last updated: March 2026</p>
                </div>

                <div className="prose prose-slate max-w-none text-foreground space-y-6">
                    <section>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introduction</h2>
                        <p className="leading-relaxed">
                            Welcome to SacraLink. This Privacy Policy explains how we collect, use, and protect your personal information when you use our application and services. By using SacraLink, you agree to the collection and use of information in accordance with this policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">2. Information We Collect</h2>
                        <p className="leading-relaxed">
                            When you register and use SacraLink, we may collect the following types of information:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li><strong>Personal Identification Information:</strong> Name, email address, and profile picture (if provided via social login).</li>
                            <li><strong>Usage Data:</strong> Information on how you interact with our platform, including login times and feature usage.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
                        <p className="leading-relaxed">
                            We use the collected data for various purposes, including:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>To provide, maintain, and secure our service.</li>
                            <li>To manage your account and authenticate you (e.g., via Google or Facebook Login).</li>
                            <li>To communicate with you regarding updates, support, and administrative messages.</li>
                        </ul>
                    </section>

                    <section id="data-deletion" className="scroll-mt-8 p-6 bg-primary/5 rounded-xl border border-primary/20">
                        <h2 className="text-2xl font-semibold mb-4 text-primary">4. User Data Deletion</h2>
                        <p className="leading-relaxed">
                            You have the right to request the deletion of your personal data stored on SacraLink.
                        </p>
                        <p className="mt-4 font-medium">To request data deletion:</p>
                        <ol className="list-decimal pl-6 space-y-2 mt-2">
                            <li>Log in to your SacraLink account.</li>
                            <li>Navigate to your Profile settings.</li>
                            <li>Currently, to permanently delete your account and all associated data, please contact the administrator or email us at <strong>tyronejamesbacolod0716@gmail.com</strong> with the subject "Data Deletion Request".</li>
                        </ol>
                        <p className="mt-4 text-sm text-muted-foreground">
                            Note: Deleting your account will permanently remove your profile, appointments, and associated records from our active database.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Third-Party Services</h2>
                        <p className="leading-relaxed">
                            We may employ third-party companies and services (such as Supabase, Google, and Meta) to facilitate our service. These third parties have access to your personal data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mt-8 mb-4">6. Contact Us</h2>
                        <p className="leading-relaxed">
                            If you have any questions about this Privacy Policy, please contact us at tyronejamesbacolod0716@gmail.com.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
