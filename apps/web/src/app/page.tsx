import { HomeHero } from '@/components/home-hero';
import { InstallationStatusSchema } from '@lingoup/contracts';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/server-api';

export default async function HomePage() {
  const setup = await serverApi('/v1/setup/status', InstallationStatusSchema).catch(() => null);
  if (setup?.enabled && setup.required && !setup.configured) redirect('/setup');
  return <HomeHero />;
}
