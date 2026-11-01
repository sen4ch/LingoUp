import type { Metadata } from 'next';
import { InstallationWizard } from '@/components/installation-wizard';

export const metadata: Metadata = {
  title: 'Set up LingoUp',
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return <InstallationWizard />;
}
