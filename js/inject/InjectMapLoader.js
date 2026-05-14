//Made by inuk
(() => {
  const scriptURL = chrome.runtime.getURL('js/features/MapLoader.js');
  if (document.querySelector(`script[src="${scriptURL}"]`)) return;

  const script = document.createElement('script');
  script.src = scriptURL;
  script.async = true;
  script.type = 'text/javascript';
  document.documentElement.appendChild(script);
})();