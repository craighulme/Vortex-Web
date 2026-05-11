//Made by inuk
const importedAssets = {
    stud: chrome.runtime.getURL("img/textures/stud.png"),
    studNormal: chrome.runtime.getURL("img/textures/studNormal.png"),

    swordMdl: chrome.runtime.getURL("mdl/swordMdl.fbx"),

    swordSlash: chrome.runtime.getURL("sounds/swordSlash.mp3"),

    sfothSong: chrome.runtime.getURL("sounds/sfothSong.mp3"),

    oofSound: chrome.runtime.getURL("sounds/oof.mp3")
};

const meta = document.createElement("meta");
meta.id = "_importedAssets";
meta.name = "_importedAssets";
meta.content = JSON.stringify(importedAssets);
document.documentElement.appendChild(meta)