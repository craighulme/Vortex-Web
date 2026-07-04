import { installCustomSiteTheme } from "./theme";
import { installPlayDocumentLoader } from "./playDocumentLoader";
import { installUpdateNotifier } from "./updateNotifier";
import { installPlayInBrowserButton } from "./playInBrowserButton";
import { installUgcLabs } from "../ugc/UgcLabs";
import "../cosmetics/VortexWebCosmetics.js";
import "../cosmetics/ProfileCosmetics.js";

installPlayDocumentLoader();
installUpdateNotifier();
installPlayInBrowserButton();
installUgcLabs();
installCustomSiteTheme();
