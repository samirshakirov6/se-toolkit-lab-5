import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

// ============================================================================
// Types for API responses
// ============================================================================

export interface ScoreBucket {
  bucket: string
  count: number
}

export interface PassRate {
  task: string
  avg_score: number
  attempts: number
}

export interface TimelineEntry {
  date: string
  submissions: number
}

export interface Lab {
  id: number
  title: string
}

// ============================================================================
// API fetch function
// ============================================================================

const API_BASE = '/analytics'

async function fetchWithAuth<T>(endpoint: string, lab: string): Promise<T> {
  const apiKey = localStorage.getItem('api_key')
  const response = await fetch(`${API_BASE}${endpoint}?lab=${encodeURIComponent(lab)}`, {
    headers: {
      Authorization: `Bearer ${apiKey ?? ''}`,
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

// ============================================================================
// Component Props
// ============================================================================

export interface DashboardProps {
  labs: Lab[]
  initialLabId?: string
}

// ============================================================================
// Dashboard Component
// ============================================================================

export function Dashboard({ labs, initialLabId }: DashboardProps): JSX.Element {
  const [selectedLab, setSelectedLab] = useState<string>(() => {
    return initialLabId ?? (labs.length > 0 ? labs[0]?.title ?? '' : '')
  })

  // State for analytics data
  const [scores, setScores] = useState<ScoreBucket[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [passRates, setPassRates] = useState<PassRate[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch analytics data when lab changes
  useEffect(() => {
    if (!selectedLab) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const fetchData = async (): Promise<void> => {
      try {
        const [scoresData, timelineData, passRatesData] = await Promise.all([
          fetchWithAuth<ScoreBucket[]>('/scores', selectedLab),
          fetchWithAuth<TimelineEntry[]>('/timeline', selectedLab),
          fetchWithAuth<PassRate[]>('/pass-rates', selectedLab),
        ])
        setScores(scoresData)
        setTimeline(timelineData)
        setPassRates(passRatesData)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    }

    void fetchData()

    return () => {
      controller.abort()
    }
  }, [selectedLab])

  // Chart data for score distribution (Bar chart)
  const scoreChartData = useMemo(() => {
    const labels = scores.map((s) => s.bucket)
    const data = scores.map((s) => s.count)

    return {
      labels,
      datasets: [
        {
          label: 'Number of Students',
          data,
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(54, 162, 235, 0.7)',
          ] as const,
          borderColor: [
            'rgb(255, 99, 132)',
            'rgb(255, 159, 64)',
            'rgb(75, 192, 192)',
            'rgb(54, 162, 235)',
          ] as const,
          borderWidth: 1,
        },
      ],
    }
  }, [scores])

  // Chart data for timeline (Line chart)
  const timelineChartData = useMemo(() => {
    const labels = timeline.map((t) => t.date)
    const data = timeline.map((t) => t.submissions)

    return {
      labels,
      datasets: [
        {
          label: 'Submissions per Day',
          data,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          tension: 0.3,
          fill: true,
        },
      ],
    }
  }, [timeline])

  // Chart options
  const chartOptions = {
    responsive: true as const,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }

  const handleLabChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedLab(e.target.value)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Analytics Dashboard</h2>
        <div className="lab-selector">
          <label htmlFor="lab-select">Select Lab: </label>
          <select
            id="lab-select"
            value={selectedLab}
            onChange={handleLabChange}
          >
            {labs.map((lab) => (
              <option key={lab.id} value={lab.title}>
                {lab.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="loading">Loading analytics...</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && !error && (
        <>
          {/* Score Distribution Bar Chart */}
          <div className="chart-container">
            <h3>Score Distribution</h3>
            <Bar data={scoreChartData} options={chartOptions} />
          </div>

          {/* Timeline Line Chart */}
          <div className="chart-container">
            <h3>Submissions Timeline</h3>
            <Line data={timelineChartData} options={chartOptions} />
          </div>

          {/* Pass Rates Table */}
          <div className="table-container">
            <h3>Pass Rates by Task</h3>
            {passRates.length > 0 ? (
              <table className="pass-rates-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Average Score</th>
                    <th>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {passRates.map((pr) => (
                    <tr key={pr.task}>
                      <td>{pr.task}</td>
                      <td>{pr.avg_score.toFixed(1)}%</td>
                      <td>{pr.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No pass rate data available.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
