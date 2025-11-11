import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
  description?: string;
}

interface ProgressIndicatorProps {
  currentStep: number;
  steps: Step[];
  className?: string;
}

export function ProgressIndicator({ currentStep, steps, className }: ProgressIndicatorProps) {
  return (
    <div className={`w-full ${className || ''}`}>
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full"
             style={{ marginLeft: '1.25rem', marginRight: '1.25rem' }}
        />

        {/* Progress bar fill */}
        <div
          className="absolute top-5 left-0 h-1 bg-green-600 rounded-full transition-all duration-500 ease-in-out"
          style={{
            marginLeft: '1.25rem',
            width: `calc(${((currentStep - 1) / (steps.length - 1)) * 100}% - 1.25rem)`
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            const stepNumber = index + 1;

            return (
              <div key={step.id} className="flex flex-col items-center" style={{ flex: 1 }}>
                {/* Circle */}
                <div
                  className={`
                    relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2
                    transition-all duration-300 font-semibold text-sm
                    ${
                      isCompleted
                        ? 'bg-green-600 border-green-600 text-white'
                        : isCurrent
                        ? 'bg-white border-green-600 text-green-600 ring-4 ring-green-100'
                        : 'bg-white border-gray-300 text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>

                {/* Label */}
                <div className="mt-2 text-center">
                  <p
                    className={`
                      text-sm font-medium transition-colors duration-300
                      ${
                        isCompleted || isCurrent
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }
                    `}
                  >
                    {step.label}
                  </p>
                  {step.description && (isCurrent || isCompleted) && (
                    <p className="text-xs text-gray-500 mt-1 max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
