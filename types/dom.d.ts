declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// This empty export statement makes the file a module, which is necessary for global augmentations.
export {}; 