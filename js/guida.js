document.addEventListener('DOMContentLoaded', () => {
  marked.setOptions({ headerIds: true, mangle: false });

  fetch('./GUIDA_OPERATORE.md')
    .then(r => r.text())
    .then(md => {
      document.getElementById('loading-md').style.display = 'none';
      document.getElementById('guida-body').innerHTML = marked.parse(md);

      // Inietta il sottotitolo subito dopo l'H1
      const h1 = document.querySelector('.guida-body h1');
      if (h1) {
        const subtitle = document.createElement('p');
        subtitle.className = 'guida-subtitle';
        subtitle.innerHTML = 'Backoffice &mdash; <em>Le Mille e Una Notte 2026</em>';
        h1.insertAdjacentElement('afterend', subtitle);
      }
    })
    .catch(() => {
      document.getElementById('loading-md').innerText = '❌ Impossibile caricare la guida.';
    });
});