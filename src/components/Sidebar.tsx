import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { api } from '../services/api';

type Entry = { _id: string; nome: string; tipo?: string };
function Glyph({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5V21h-7v-7h-4v7H3z',
    campaign: 'M4 5h16v14H4z M8 5v14 M12 8h5 M12 12h5',
    sessions: 'M4 6h16 M4 11h16 M4 16h12 M4 20h9',
    audio: 'M3 12h2l2-5 4 10 3-14 3 9h4',
    people: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8a3 3 0 0 1 0 6 M20 20v-2a4 4 0 0 0-3-3.87',
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M4 12l2-1 .5-2L5 7l2-2 2 1.5 2-.5 1-2h3l1 2 2 .5L20 5l2 2-1.5 2 .5 2 2 1v2l-2 1-.5 2L22 19l-2 2-2-1.5-2 .5-1 2h-3l-1-2-2-.5L7 21l-2-2 1.5-2-.5-2-2-1z',
    lab: 'M9 3h6 M10 3v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3 M8 16h8',
    chevron: 'm7 10 5 5 5-5',
    fold: 'M15 18 9 12l6-6',
    menu: 'M3 6h18 M3 12h18 M3 18h18',
    close: 'M5 5l14 14 M19 5 5 19'
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.home} /></svg>;
}
export default function Sidebar() {
  const { campaigns, current, setCurrentById } = useCampaign();
  const [characters, setCharacters] = useState<Entry[]>([]);
  const [scenarios, setScenarios] = useState<Entry[]>([]);
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('imagine:compact') === 'true');
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    let alive = true;
    setCharacters([]); setScenarios([]);
    if (!current) return;
    Promise.allSettled([
      api.get<Entry[]>('/characters', { params: { campanhaId: current._id } }),
      api.get<Entry[]>('/scenarios', { params: { campanhaId: current._id } })
    ]).then(results => {
      if (!alive) return;
      if (results[0].status === 'fulfilled') setCharacters(results[0].value.data);
      if (results[1].status === 'fulfilled') setScenarios(results[1].value.data);
    });
    const refresh = () => {
      api.get<Entry[]>('/characters', { params: { campanhaId: current._id } }).then(r => { if (alive) setCharacters(r.data); }).catch(() => {});
      api.get<Entry[]>('/scenarios', { params: { campanhaId: current._id } }).then(r => { if (alive) setScenarios(r.data); }).catch(() => {});
    };
    window.addEventListener('charactersUpdated', refresh);
    window.addEventListener('scenariosUpdated', refresh);
    return () => { alive = false; window.removeEventListener('charactersUpdated', refresh); window.removeEventListener('scenariosUpdated', refresh); };
  }, [current?._id]);
  const nav = (to: string, title: string, icon: string, enabled = true) => enabled ? <NavLink key={to} to={to} end={to === '/' || to === '/campaigns'} title={compact ? title : undefined} className={({ isActive }) => 'it-nav-link' + (isActive ? ' it-nav-link--active' : '')}><Glyph name={icon}/>{!compact && <span>{title}</span>}</NavLink> : null;
  const toggle = () => { const next = !compact; setCompact(next); window.localStorage.setItem('imagine:compact', String(next)); };
  return <>
    <button type="button" className="it-menu-trigger" aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} onClick={() => setOpen(!open)}><Glyph name={open ? 'close' : 'menu'}/></button>
    <div className={'it-overlay' + (open ? ' it-overlay--open' : '')} onClick={() => setOpen(false)} aria-hidden="true" />
    <aside className={'it-side' + (compact ? ' it-side--compact' : '') + (open ? ' it-side--open' : '')} aria-label="Navegação principal">
      <Link className="it-side-logo" to="/dashboard" title="Imagine it"><span className="it-brand-mark"><svg width="26" height="26" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="currentColor" strokeOpacity=".5"/><path d="m14 3 4 11-4 11-4-11 4-11Z" stroke="currentColor"/><circle cx="14" cy="14" r="2" fill="currentColor"/></svg></span>{!compact && <span className="text-base font-bold tracking-tight">Imagine <span style={{ color: '#A99AFF' }}>it</span><small className="block text-[9px] font-medium uppercase tracking-[.27em] text-[#747989]">Campaign intelligence</small></span>}</Link>
      {!compact && <div className="it-side-campaign"><div className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#858A9A]">Campanha ativa</div><select aria-label="Selecionar campanha" value={current?._id || ''} onChange={e => setCurrentById(e.target.value)}><option value="" disabled>{campaigns.length ? 'Selecione uma campanha' : 'Nenhuma campanha'}</option>{campaigns.map(c => <option key={c._id} value={c._id}>{c.nome}</option>)}</select></div>}
      <nav className="it-side-scroll">
        {!compact && <p className="it-side-group">Principal</p>}
        {nav('/dashboard', 'Visão geral', 'home')}
        {nav('/', 'Campanhas', 'campaign')}
        {nav('/sessions', 'Sessões', 'sessions', Boolean(current))}
        {nav('/live', 'Ao vivo', 'audio', Boolean(current))}
        {current && <>
          {!compact && <p className="it-side-group">Campanha selecionada</p>}
          {nav('/characters', 'Personagens', 'people')}
          {nav('/scenarios', 'Cenários', 'map')}
          {nav('/campaigns/' + current._id + '/settings', 'Configurações', 'settings')}
          {!compact && <div className="it-side-details">
            <details><summary>Personagens recentes <Glyph name="chevron" /></summary>{characters.slice(0, 5).map(c => <Link key={c._id} to={'/characters/' + c._id}>{c.nome}</Link>)}{!characters.length && <span className="block px-3 py-2 text-xs text-[#747989]">Nenhum personagem</span>}</details>
            <details><summary>Cenários recentes <Glyph name="chevron" /></summary>{scenarios.slice(0, 5).map(s => <Link key={s._id} to="/scenarios">{s.nome}</Link>)}{!scenarios.length && <span className="block px-3 py-2 text-xs text-[#747989]">Nenhum cenário</span>}</details>
          </div>}
        </>}
        {!compact && <p className="it-side-group">Ferramentas</p>}
        {nav('/benchmarks', 'Benchmarks', 'lab')}
      </nav>
      <div className="it-side-bottom"><button type="button" className="it-collapse" onClick={toggle} aria-label={compact ? 'Expandir menu' : 'Recolher menu'}><Glyph name="fold"/>{!compact && <span>Recolher menu</span>}</button></div>
    </aside>
  </>;
}
