const importedAssets = {
    stud: chrome.runtime.getURL("img/textures/stud.png"),
    studNormal: chrome.runtime.getURL("img/textures/studNormal.png"),

    swordMdl: chrome.runtime.getURL("files/meshes/swordMdl.fbx"),
    playerMdl: chrome.runtime.getURL("files/meshes/player.fbx"),

    swordSlash: chrome.runtime.getURL("files/sounds/swordSlash.mp3"),
    placeBlock: chrome.runtime.getURL("files/sounds/placeBlock.mp3"),
    sfothSong: chrome.runtime.getURL("files/sounds/sfothSong.mp3"),
    buildSong: chrome.runtime.getURL("files/sounds/buildSong.mp3"),

    oofSound: chrome.runtime.getURL("files/sounds/oof.mp3"),

    imgdata: {
        banners: {
            buildingplace: chrome.runtime.getURL("img/games/website/banners/buildingplace.jpeg"),
            crossroads: chrome.runtime.getURL("img/games/website/banners/crossroads.jpeg"),
            partyexe: chrome.runtime.getURL("img/games/website/banners/party-exe.webp"),
            sfoth: chrome.runtime.getURL("img/games/website/banners/sfoth.webp"),
            swordfightingbaseplate: chrome.runtime.getURL("img/games/website/banners/swordfightingbaseplate.png"),
            baseplate: chrome.runtime.getURL("img/games/website/banners/baseplate.png"),
            Glasshouses: chrome.runtime.getURL("img/games/website/banners/Glasshouses.webp"),
            NDS: chrome.runtime.getURL("img/games/website/banners/NDS.png")
        },

        icons: {
            buildingplace: chrome.runtime.getURL("img/games/website/icons/buildingplace.png"),
            crossroads: chrome.runtime.getURL("img/games/website/icons/crossroads.png"),
            partyexe: chrome.runtime.getURL("img/games/website/icons/party-exe.png"),
            sfoth: chrome.runtime.getURL("img/games/website/icons/sfoth.webp"),
            swordfightingbaseplate: chrome.runtime.getURL("img/games/website/icons/swordfightingbaseplate.png"),
            baseplate: chrome.runtime.getURL("img/games/website/icons/baseplate.png"),
            Glasshouses: chrome.runtime.getURL("img/games/website/icons/Glasshouses.webp"),
            NDS: chrome.runtime.getURL("img/games/website/icons/NDS.png")
        }
    },
    mapdata: {
        PARTYexe: chrome.runtime.getURL("files/mapdata/PARTY-exe.json"),
        BuildingPlace: chrome.runtime.getURL("files/mapdata/BuildingPlace.json"),
        Crossroads: chrome.runtime.getURL("files/mapdata/Crossroads.json"),
        SFBaseplate: chrome.runtime.getURL("files/mapdata/SFBaseplate.json"),
        SFOTH: chrome.runtime.getURL("files/mapdata/SFOTH.json"),
        Baseplate: chrome.runtime.getURL("files/mapdata/Baseplate.json"),
        Glasshouses: chrome.runtime.getURL("files/mapdata/Glasshouses.json"),
        NDS: chrome.runtime.getURL("files/mapdata/NDS.json")
    }
};

const overrides = new Map([
    ["three.min.js", "overrides/libs/three.module.js"],
    ["FBXLoader.js", "overrides/libs/FBXLoader2.js"],
    ["inflate.min.js", "overrides/libs/inflate.min.js"],

    ["inline_1.js", "overrides/inline_1.js"],

    ["notifications.js", "overrides/notifications.js"],
    ["leaderboard.js", "overrides/leaderboard.js"],
    ["chat.js", "overrides/chat.js"],
    ["avatar.js", "overrides/avatar.js"],
    ["parts.js", "overrides/demoparts.js"],
    ["social.js", "overrides/social.js"],

    ["vortex-engine.js", "overrides/vortex2+2-engine.js"],
    ["multiplayer.js", "overrides/vortex2+2-multiplayer.js"]
]);

function replaceUrl(src) {
    if (!src) return null;
    const file = src.split("/").pop();
    const target = overrides.get(file);
    if (!target) return src;
    return chrome.runtime.getURL(target);
}

var url_string = document.URL;
var url = new URL(url_string);
var play = url.searchParams.get("Play");
if (play) {
    console.log('play')

    async function init() {
        let html = await fetch(
            chrome.runtime.getURL("overrides/play.html")
        ).then(r => r.text());

        html = html.replace(
            /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/g, //crazy
            (match, src) => {
                const file = src.split("/").pop();
                const override = overrides.get(file);

                if (!override) return match;

                const newSrc = chrome.runtime.getURL(override);

                return match.replace(src, newSrc);
            }
        );

        document.open();
        document.write(html);
        document.close();

        const meta = document.createElement("meta");
        meta.id = "_importedAssets";
        meta.name = "_importedAssets";
        meta.content = JSON.stringify(importedAssets);
        document.documentElement.appendChild(meta)
    }
    init();
} else {
    if (url.searchParams.get("V22GameId")) {
        const warn = document.createElement('div');
        warn.innerHTML = `
            <h2>vortex2+2 warning</h2>
            <br>
            <p>vortex2+2 multiplayer does not work anymore,breaking lots of things,<br>and there's nothing I can currently do about it.<br>the old vortex Websocket server that 2+2 used for multiplayer have been removed,<br>and I don't think it'll ever come back again.</p>
            <br>
            <br>
        `;
        warn.style = `
            position: absolute;
            left: 0;
            width: 100%;
            top: 0;
            height: 100%;
            background-color: rgba(0.1,0.1,0.1,0.8);
            align-content: center;
            text-align: center;
            padding: 20px;
            border: solid 5px black;
            backdrop-filter: blur(3px);
            z-index: 10;
        `
        const closebtn = document.createElement('button');
        closebtn.style = `
            padding: 10px;
            background-color: rgb(255,100,100) !important;
        `;
        closebtn.innerHTML = 'close';
        warn.appendChild(closebtn);
        closebtn.onclick = function () {
            warn.remove();
        }
        var observer = new MutationObserver(function () {
            if (document.body) {
                document.body.appendChild(warn);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
    const meta = document.createElement("meta");
    meta.id = "_importedAssets";
    meta.name = "_importedAssets";
    meta.content = JSON.stringify(importedAssets);
    document.documentElement.appendChild(meta)
}