import type { CollectorWindow } from '@/src/features/retailSync/shared/services/retailCollector';
import { WalmartCollector } from '@/src/features/retailSync/walmart/services/walmartCollector';

export default defineUnlistedScript(() => {
	const page = window as CollectorWindow;
	page.__wingspanRetail ??= {};
	page.__wingspanRetail.walmart ??= new WalmartCollector(window);
});
