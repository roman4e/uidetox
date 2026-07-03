function render(nodes, root) {
  root.innerHTML = '';
  for (const n of nodes) {
    const div = document.createElement('div');
    div.className = 'node';
    div.textContent = '<' + n.tag + '>';
    const attrs = Object.entries(n.attrs).map(([k, v]) => k + '="' + v + '"').join(' ');
    if (attrs) {
      const s = document.createElement('span');
      s.className = 'attr';
      s.textContent = attrs;
      div.appendChild(s);
    }
    root.appendChild(div);
    if (n.children.length) {
      const child = document.createElement('div');
      child.className = 'tree';
      render(n.children, child);
      root.appendChild(child);
    }
  }
}

function refresh() {
  chrome.devtools.inspectedWindow.eval(
    "(function(){ try { return window.__uidetox__?.inspect?.() ?? []; } catch(e) { return []; } })()",
    (result) => render(result || [], document.getElementById('tree'))
  );
}

refresh();
setInterval(refresh, 1000);
