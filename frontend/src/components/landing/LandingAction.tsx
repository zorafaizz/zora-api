import { ArrowRight, ArrowUpRight } from 'lucide-react';

export function LandingAction({ href, children, secondary = false }: { href: string; children: string; secondary?: boolean }) {
  const Icon = secondary ? ArrowUpRight : ArrowRight;
  return (
    <a href={href} aria-label={children} className={`landing-action ${secondary ? 'landing-action-secondary' : 'landing-action-primary'}`}>
      <span className="landing-action-label" aria-hidden="true">
        <span>{children}</span><span>{children}</span>
      </span>
      <span className="landing-action-arrow" aria-hidden="true"><Icon /><Icon /></span>
    </a>
  );
}
