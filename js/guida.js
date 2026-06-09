document.addEventListener('DOMContentLoaded', () => {
  fetch('./GUIDA_OPERATORE.md')
    .then(r => r.text())
    .then(md => {
      document.getElementById('loading-md').style.display = 'none';
      document.getElementById('guida-body').innerHTML = marked.parse(md);
    })
    .catch(() => {
      document.getElementById('loading-md').innerText = '&#10060; Impossibile caricare la guida.';
    });
});