import {setupNav,enforceUonMaintenance,watchUonMaintenance} from './core.js?v=44.0.0';
import {bootUnifiedTools} from './tool-registry-v44.js?v=44.0.0';
import {bootPlatformExperience} from './platform-experience-v44.js?v=44.0.0';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();
await bootUnifiedTools();
bootPlatformExperience();
