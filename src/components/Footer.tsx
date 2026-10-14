import { version } from '../../package.json';

export function Footer() {
  return (
    <footer className="workspace-footer">
      <span>© {new Date().getFullYear()} l0ee. · AnyFormat v{version} · Files stay on your device.</span>
      <div className="workspace-footer-links">
        <a href="https://github.com/l0ee/anyformat" target="_blank" rel="noreferrer">Source on GitHub</a>
        <a href="https://github.com/l0ee/anyformat/issues" target="_blank" rel="noreferrer">Feedback</a>
        <span>MIT licensed</span>
      </div>
    </footer>
  );
}

export default Footer;
