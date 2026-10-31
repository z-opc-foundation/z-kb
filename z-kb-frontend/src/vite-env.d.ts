/// <reference types="vite/client" />

declare const __BUILD_ENV__: string;
declare const __LOCAL_ACTOR_ID__: string;

interface Window {
  ENV_TYPE?: string;
}
