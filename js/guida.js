document.addEventListener('DOMContentLoaded', () => {
  marked.setOptions({ headerIds: true, mangle: false });

  fetch('./GUIDA_OPERATORE.md')
    .then(r => r.text())
    .then(md => {
      document.getElementById('loading-md').style.display = 'none';
      const body = document.getElementById('guida-body');
      body.innerHTML = marked.parse(md);

      // Sottotitolo subito dopo H1
      const h1 = body.querySelector('h1');
      if (h1) {
        const subtitle = document.createElement('p');
        subtitle.className = 'guida-subtitle';
        subtitle.innerHTML = 'Backoffice &mdash; <em>Le Mille e Una Notte 2026</em>';
        h1.insertAdjacentElement('afterend', subtitle);
      }

      // "↑ Torna all'indice" prima di ogni h2 numerato (sezioni 1-6)
      body.querySelectorAll('h2').forEach(h2 => {
        if (/^\d+\./.test(h2.textContent.trim())) {
          const link = document.createElement('a');
          link.href = '#indice';
          link.className = 'back-to-index';
          link.innerHTML = '&#8593; Torna all\'indice';
          h2.parentNode.insertBefore(link, h2);
        }
      });

      // Uno anche in fondo al contenuto
      const lastLink = document.createElement('a');
      lastLink.href = '#indice';
      lastLink.className = 'back-to-index';
      lastLink.innerHTML = '&#8593; Torna all\'indice';
      body.appendChild(lastLink);
    })
    .catch(() => {
      document.getElementById('loading-md').innerText = '❌ Impossibile caricare la guida.';
    });
});