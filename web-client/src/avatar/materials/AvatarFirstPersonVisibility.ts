export function setLocalFirstPersonHidden(
  characterModel: any,
  hidden: boolean,
  options: { hideBody?: boolean } = {},
  prepareModernAvatarMaterials: (characterModel: any) => { headMaterials?: any[] } | null | undefined
): void {
  if (!characterModel) return;
  const hideBody = Boolean(options.hideBody);
  characterModel.visible = !(hidden && hideBody);
  const materials = prepareModernAvatarMaterials(characterModel);
  const hideHead = hideBody ? false : hidden;
  for (const material of materials?.headMaterials || []) {
    setMaterialCameraHiddenButShadowCasting(material, hideHead);
  }
  characterModel.traverse?.((node: any) => {
    if (!/FaceOverlay$/.test(node.name || "")) return;
    node.userData.vwebFirstPersonHidden = hideHead;
    node.visible = hideHead ? false : Boolean(node.material?.map);
  });
}

function setMaterialCameraHiddenButShadowCasting(material: any, hidden: boolean): void {
  if (!material) return;
  material.userData ||= {};
  if (hidden) {
    if (!material.userData.vwebFirstPersonMaterialState) {
      material.userData.vwebFirstPersonMaterialState = {
        transparent: material.transparent,
        opacity: material.opacity,
        colorWrite: material.colorWrite,
        depthWrite: material.depthWrite,
        visible: material.visible
      };
    }
    material.visible = true;
    material.transparent = true;
    material.opacity = 0;
    material.colorWrite = false;
    material.depthWrite = false;
    material.needsUpdate = true;
    return;
  }

  const previous = material.userData.vwebFirstPersonMaterialState;
  if (previous) {
    material.transparent = previous.transparent;
    material.opacity = previous.opacity;
    material.colorWrite = previous.colorWrite;
    material.depthWrite = previous.depthWrite;
    material.visible = previous.visible;
    delete material.userData.vwebFirstPersonMaterialState;
  } else {
    material.visible = true;
  }
  material.needsUpdate = true;
}
