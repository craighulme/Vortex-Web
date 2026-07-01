type LaunchInfo = {
  shirtId?: unknown;
  pantId?: unknown;
  bodyType?: unknown;
  bodyColors?: unknown;
  faceId?: unknown;
};

type NormalizedAvatar = {
  shirt_id: unknown;
  pant_id: unknown;
  body_type: unknown;
  body_colors: unknown;
  face_id: unknown;
};

export function createMultiplayerLaunchState() {
  let myId: unknown = null;
  let launchInfo: LaunchInfo | null = null;

  function getSelfId() {
    return myId;
  }

  function setSelfId(id: unknown) {
    myId = id;
  }

  function getLaunchInfo() {
    return launchInfo;
  }

  function setLaunchInfo(info: LaunchInfo | null) {
    launchInfo = info;
  }

  function updateLaunchAvatar(normalized: NormalizedAvatar) {
    if (!launchInfo) return;
    launchInfo.shirtId = normalized.shirt_id;
    launchInfo.pantId = normalized.pant_id;
    launchInfo.bodyType = normalized.body_type;
    launchInfo.bodyColors = normalized.body_colors;
    launchInfo.faceId = normalized.face_id;
  }

  function currentLaunchAvatar(normalizeAvatarFields: (value: Record<string, unknown>) => NormalizedAvatar) {
    return normalizeAvatarFields({
      shirt_id: launchInfo?.shirtId || 0,
      pant_id: launchInfo?.pantId || 0,
      body_type: launchInfo?.bodyType || "male",
      body_colors: launchInfo?.bodyColors || [],
      face_id: launchInfo?.faceId || 0
    });
  }

  return {
    getSelfId,
    setSelfId,
    getLaunchInfo,
    setLaunchInfo,
    updateLaunchAvatar,
    currentLaunchAvatar
  };
}
