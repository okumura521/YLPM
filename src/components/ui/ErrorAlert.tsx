import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getUserFriendlyErrorMessage } from '@/lib/errorMessages';

interface ErrorAlertProps {
  error: string | Error;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({ error, onDismiss, className }: ErrorAlertProps) {
  const navigate = useNavigate();
  const friendlyError = getUserFriendlyErrorMessage(error);

  const handleAction = () => {
    if (friendlyError.action) {
      navigate(friendlyError.action);
    }
  };

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{friendlyError.title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{friendlyError.description}</p>
        <div className="flex gap-2 flex-wrap">
          {friendlyError.action && (
            <Button
              onClick={handleAction}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-100 text-red-600 border-red-200"
            >
              {friendlyError.actionLabel || 'アクション'}
            </Button>
          )}
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-100 text-gray-600 border-gray-200"
            >
              閉じる
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
