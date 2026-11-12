// Foreground canvases are transparent around the held object. Start those
// gestures on the room canvas; its pointer capture then owns move/up/cancel.
export function passPointerToRoom(event:PointerEvent,element:HTMLElement){
 const room=element.closest('.game-space')?.querySelector<HTMLCanvasElement>('.room-three-canvas');
 if(!room)return;
 event.preventDefault();event.stopPropagation();
 room.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,
  pointerId:event.pointerId,pointerType:event.pointerType,isPrimary:event.isPrimary,
  clientX:event.clientX,clientY:event.clientY,button:event.button,buttons:event.buttons,pressure:event.pressure}));
}
