declare module 'despia-native' {
  interface Despia {
    onesignalplayerid?: string;
    oneSignalPlayerId?: string;
    (command: string, args?: any[]): any;
  }
  const despia: Despia;
  export default despia;
}


