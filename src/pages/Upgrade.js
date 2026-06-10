import { Link, useParams } from 'react-router-dom';
import { getModule, planThatUnlocks, PLANS } from '../config/modules';

export default function Upgrade() {
  const { moduleKey } = useParams();
  const module = getModule(moduleKey);
  const requiredPlan = planThatUnlocks(moduleKey);
  const plan = requiredPlan ? PLANS[requiredPlan] : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {module ? `${module.label} isn't available on your plan` : 'This feature isn\'t available on your plan'}
        </h2>
        <p className="text-gray-600 mb-2">
          {module ? module.description : 'Upgrade your plan to unlock this feature.'}
        </p>
        {plan && (
          <p className="text-gray-600 mb-6">
            Upgrade to the <span className="font-semibold">{plan.name}</span> plan to unlock it.
            {' '}{plan.description}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/settings/plan"
            className="inline-block px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
          >
            View plans
          </Link>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
