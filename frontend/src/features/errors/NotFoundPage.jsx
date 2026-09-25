import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/Feedback'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="panel mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={Compass}
        title="This trail doesn't exist"
        description="The page you were looking for has moved or was never here."
        action={<Button onClick={() => navigate('/')}>Return to dashboard</Button>}
      />
    </div>
  )
}
