import { useId } from 'react';

/** Original vector studies of shared infrastructure: a ring, a signal, a stack. */
export function Artwork({ variant = 'orange', large = false }: { variant?: string; large?: boolean }) {
  const id = useId().replaceAll(':', '');
  return <div className={`artwork art-${variant} ${large ? 'large' : ''}`} aria-hidden="true">
    <span className="art-coordinate">RØ / {variant === 'orange' ? '01' : variant === 'lime' ? '02' : '03'}</span>
    <svg viewBox="0 0 480 350" className="sculpture">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff1d2"/><stop offset=".3" stopColor="#d88251"/><stop offset=".5" stopColor="#603828"/><stop offset=".7" stopColor="#2a271f"/><stop offset="1" stopColor="#d39a6b"/></linearGradient>
        <linearGradient id={`${id}-dark`}><stop stopColor="#232722"/><stop offset=".55" stopColor="#686e50"/><stop offset="1" stopColor="#171b17"/></linearGradient>
        <linearGradient id={`${id}-pale`} x2=".8" y2="1"><stop stopColor="#f9e7cc"/><stop offset=".5" stopColor="#c3adf0"/><stop offset="1" stopColor="#5d437e"/></linearGradient>
        <pattern id={`${id}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".12"/></pattern>
        <filter id={`${id}-shadow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12"/></filter>
      </defs>
      <rect width="480" height="350" fill={`url(#${id}-grid)`}/>
      <ellipse cx="250" cy="285" rx="116" ry="19" fill="#1c1e19" opacity=".2" filter={`url(#${id}-shadow)`}/>
      {variant === 'orange' ? <g transform="translate(242 170) rotate(-32)">
        {Array.from({ length: 18 }, (_, i) => <ellipse key={i} cx={0} cy={27 - i * 2.6} rx={113} ry={83} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={28}/>)}
        <ellipse cy="-19" rx="113" ry="83" fill="none" stroke="#e5a275" strokeWidth="2" opacity=".8"/>
        <ellipse cy="-16" rx="97" ry="66" fill="none" stroke="#422f25" strokeWidth="2"/>
        <path d="M-4 -130v44M-4 52v41" stroke="#22251e" strokeWidth="12"/>
      </g> : variant === 'lime' ? <g transform="translate(240 175) rotate(-21)">
        {Array.from({ length: 9 }, (_, i) => <g key={i} transform={`translate(${(i - 4) * 25} 0)`}>
          <rect x="-10" y={-35 - Math.sin(i * .65) * 60} width="21" height={70 + Math.sin(i * .65) * 120} rx="10" fill={`url(#${id}-dark)`}/>
          <path d={`M-6 ${-29 - Math.sin(i * .65) * 60}v${55 + Math.sin(i * .65) * 120}`} stroke="#dadfaf" opacity=".45"/>
        </g>)}
      </g> : <g transform="translate(246 157) rotate(-23)">
        {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`translate(${Math.sin(i * .7) * 18} ${i * 13 - 50})`}>
          <path d="M-102 0L-12 -45L103 0L14 45Z" fill={`url(#${id}-pale)`} stroke="#423344" strokeWidth="1"/>
          <path d="M-102 0v12L14 57V45Z" fill="#493b53"/><path d="M14 45v12L103 12V0Z" fill="#7c628f"/>
        </g>)}
      </g>}
      <g stroke="currentColor" opacity=".55"><path d="M28 302h14m-7 -7v14M438 46h14m-7 -7v14"/></g>
    </svg>
    <span className="art-caption">{variant === 'orange' ? 'BUILT AROUND EACH OTHER' : variant === 'lime' ? 'A SIGNAL WORTH SHARING' : 'THE FUTURE IS CIRCULAR'}</span>
  </div>;
}
