// Public API of the AI Gateway module. Other modules import only from this file.
export { AiGatewayModule } from './ai-gateway.module.js';
export { AiGateway, type AiCallContext, type AiGatewayOutcome } from './application/ai-gateway.js';
export { SpeechGateway, type SpeechOutcome } from './application/speech-gateway.js';
export { SPEECH_AUDIO_TYPE } from './application/speech-provider.js';
export { MOCK_PROVIDER_NAME } from './infrastructure/mock-ai-provider.js';
export { RecognitionGateway } from './application/recognition-gateway.js';
export { ListeningAudioGateway } from './application/listening-audio-gateway.js';
