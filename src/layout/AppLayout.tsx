import Sidebar from '../components/Sidebar';
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="imagine-shell"><Sidebar/><main className="imagine-main"><div className="imagine-content">{children}</div></main></div>;
}
