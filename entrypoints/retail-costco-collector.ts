import { CostcoCollector } from '@/src/features/retailSync/costco/services/costcoCollector';
import type { CollectorWindow } from '@/src/features/retailSync/shared/services/retailCollector';

export default defineUnlistedScript(() => {
	const page = window as CollectorWindow;
	page.__wingspanRetail ??= {};
	page.__wingspanRetail.costco ??= new CostcoCollector(window);
});
