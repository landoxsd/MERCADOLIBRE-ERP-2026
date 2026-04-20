import { redirect } from 'next/navigation';

// La raíz redirige al login; si ya hay sesión, el middleware redirigirá al dashboard
export default function HomePage() {
  redirect('/auth');
}
