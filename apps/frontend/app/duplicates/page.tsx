'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Progress,
} from '@repo/ui'
import {
  Search,
  Trash2,
  HardDrive,
  Users,
  AlertTriangle,
  Loader2,
  Eye,
  Trash,
} from 'lucide-react'
import type {
  DuplicateGroup,
  DuplicateFile,
  DuplicateStats,
  SimilarityThresholds,
} from '@/types'
import { formatFileSize } from '@/lib/utils'
import { API_URL } from '@/lib/config'
import {
  DEFAULT_THRESHOLDS,
  serializeThresholds,
} from '@/lib/threshold-presets'
import { ThresholdSettings } from '@/components/threshold-settings'
import LazyImage from '@/components/lazy-image'

interface ScanResult {
  groups: DuplicateGroup[]
  stats: DuplicateStats
  thresholds?: SimilarityThresholds
}

export default function DuplicatesPage() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [thresholds, setThresholds] =
    useState<SimilarityThresholds>(DEFAULT_THRESHOLDS)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // 프로그래스 상태
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStep, setScanStep] = useState('')
  const [scanMessage, setScanMessage] = useState('')

  const startScan = async () => {
    setIsScanning(true)
    setScanProgress(0)
    setScanStep('')
    setScanMessage('')
    setScanResult(null)
    setSelectedFiles(new Set())

    try {
      // 임계값을 URL 파라미터로 직렬화
      const params = new URLSearchParams(serializeThresholds(thresholds))
      const eventSource = new EventSource(
        `${API_URL}/api/duplicates/progress?${params.toString()}`
      )

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          setScanStep(data.step)
          setScanProgress(data.progress || 0)
          setScanMessage(data.message || '')

          // 스캔 완료시 결과 처리
          if (data.step === 'completed' && data.result) {
            const groups = data.result.groups || []
            const usedThresholds = data.result.thresholds || thresholds
            const stats: DuplicateStats = {
              totalFiles: data.result.totalFiles || 0,
              totalGroups: groups.length,
              totalDuplicates: data.result.duplicateFiles || 0,
              totalWastedSpace: groups.reduce(
                (sum: number, group: DuplicateGroup) => {
                  // 각 그룹에서 가장 작은 파일을 제외한 나머지 크기 합계
                  const sortedFiles = [...group.files].sort(
                    (a, b) => a.size - b.size
                  )
                  return (
                    sum +
                    sortedFiles
                      .slice(1)
                      .reduce((groupSum, file) => groupSum + file.size, 0)
                  )
                },
                0
              ),
              imageGroups: groups.filter(
                (g: DuplicateGroup) => g.type === 'image'
              ).length,
              videoGroups: groups.filter(
                (g: DuplicateGroup) => g.type === 'video'
              ).length,
            }

            setScanResult({ groups, stats, thresholds: usedThresholds })
            setIsScanning(false)
            eventSource.close()
          } else if (data.step === 'error') {
            console.error('Scan error:', data.message)
            setIsScanning(false)
            eventSource.close()
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        setIsScanning(false)
      }

      eventSource.addEventListener('close', () => {
        setIsScanning(false)
      })
    } catch (error) {
      console.error('Error starting scan:', error)
      setIsScanning(false)
    }
  }

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath)
    } else {
      newSelected.add(filePath)
    }
    setSelectedFiles(newSelected)
  }

  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return

    const filePaths = Array.from(selectedFiles)
    try {
      const response = await fetch(`${API_URL}/api/duplicates`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePaths }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`Deleted ${result.success} files, failed ${result.failed}`)

        // 삭제된 파일들을 결과에서 제거
        if (scanResult) {
          const updatedGroups = scanResult.groups
            .map((group) => ({
              ...group,
              files: group.files.filter(
                (file) => !filePaths.includes(file.path)
              ),
            }))
            .filter((group) => group.files.length > 1) // 1개 이하의 파일이 남은 그룹 제거

          setScanResult({
            ...scanResult,
            groups: updatedGroups,
          })
        }

        setSelectedFiles(new Set())
      }
    } catch (error) {
      console.error('Error deleting files:', error)
    }
  }

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const filteredGroups =
    scanResult?.groups.filter((group) =>
      group.files.some(
        (file) =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.path.toLowerCase().includes(searchTerm.toLowerCase())
      )
    ) || []

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">중복 파일 관리</h1>
          <p className="text-muted-foreground">
            이미지와 동영상의 중복 파일을 찾아 관리합니다
          </p>
        </div>
        <Button
          onClick={startScan}
          disabled={isScanning}
          className="min-w-[120px]"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              스캔 중...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              중복 스캔
            </>
          )}
        </Button>
      </div>

      {/* 임계값 설정 */}
      <ThresholdSettings
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
        className="mb-6"
      />

      {/* 프로그래스 바 */}
      {isScanning && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">스캔 진행 상황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{scanMessage || '준비 중...'}</span>
                <span>{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} className="w-full" />
            </div>
            {scanStep && (
              <div className="text-sm text-muted-foreground">
                현재 단계: {scanStep}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 통계 카드 */}
      {scanResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 파일</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scanResult.stats.totalFiles}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">중복 그룹</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scanResult.stats.totalGroups}
              </div>
              <p className="text-xs text-muted-foreground">
                이미지: {scanResult.stats.imageGroups}, 동영상:{' '}
                {scanResult.stats.videoGroups}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">중복 파일</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {scanResult.stats.totalDuplicates}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">낭비된 공간</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatFileSize(scanResult.stats.totalWastedSpace)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 검색 및 액션 바 */}
      {scanResult && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="파일명 또는 경로로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedFiles.size}개 파일 선택됨
            </span>
            <Button
              variant="destructive"
              onClick={deleteSelectedFiles}
              disabled={selectedFiles.size === 0}
            >
              <Trash className="w-4 h-4 mr-2" />
              선택한 파일 삭제
            </Button>
          </div>
        </div>
      )}

      {/* 중복 그룹 목록 */}
      {scanResult && (
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  {searchTerm
                    ? '검색 조건에 맞는 중복 파일이 없습니다.'
                    : '중복 파일이 발견되지 않았습니다.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map((group) => (
              <DuplicateGroupCard
                key={group.id}
                group={group}
                selectedFiles={selectedFiles}
                onToggleSelection={toggleFileSelection}
                isExpanded={expandedGroups.has(group.id)}
                onToggleExpansion={() => toggleGroupExpansion(group.id)}
              />
            ))
          )}
        </div>
      )}

      {/* 초기 상태 */}
      {!scanResult && !isScanning && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              중복 파일 스캔을 시작하세요
            </h3>
            <p className="text-muted-foreground mb-4">
              상단의 &ldquo;중복 스캔&rdquo; 버튼을 클릭하여 중복된 이미지와
              동영상을 찾아보세요.
            </p>
            <Button onClick={startScan}>
              <Search className="w-4 h-4 mr-2" />
              중복 스캔 시작
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface DuplicateGroupCardProps {
  group: DuplicateGroup
  selectedFiles: Set<string>
  onToggleSelection: (filePath: string) => void
  isExpanded: boolean
  onToggleExpansion: () => void
}

function DuplicateGroupCard({
  group,
  selectedFiles,
  onToggleSelection,
  isExpanded,
  onToggleExpansion,
}: DuplicateGroupCardProps) {
  // 대표 이미지 선택 (첫 번째 파일)
  const representativeFile = group.files[0]
  const [imageError, setImageError] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 대표 이미지 미리보기 */}
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {!imageError ? (
                <LazyImage
                  src={
                    group.type === 'image'
                      ? `${API_URL}/api/media${encodeURI(representativeFile.relativePath)}`
                      : `${API_URL}/api/thumbnail?path=${encodeURIComponent(representativeFile.relativePath)}`
                  }
                  alt={representativeFile.name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  {group.type === 'image' ? (
                    <svg
                      className="w-8 h-8 text-muted-foreground"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      className="w-8 h-8 text-purple-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {group.type === 'image' ? '이미지' : '동영상'} 중복 그룹
              </CardTitle>
              <Badge
                variant={group.similarity === 100 ? 'destructive' : 'secondary'}
              >
                {group.similarity}% 유사
              </Badge>
              <Badge variant="outline">{group.files.length}개 파일</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleExpansion}>
            <Eye className="w-4 h-4 mr-2" />
            {isExpanded ? '접기' : '펼치기'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.files.map((file) => (
              <DuplicateFileCard
                key={file.path}
                file={file}
                group={group}
                isSelected={selectedFiles.has(file.path)}
                onToggleSelection={() => onToggleSelection(file.path)}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface DuplicateFileCardProps {
  file: DuplicateFile
  group: DuplicateGroup
  isSelected: boolean
  onToggleSelection: () => void
}

function DuplicateFileCard({
  file,
  group,
  isSelected,
  onToggleSelection,
}: DuplicateFileCardProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-red-500 bg-red-50 dark:bg-red-950'
          : 'border-border hover:border-muted-foreground'
      }`}
      onClick={onToggleSelection}
    >
      {/* 썸네일 또는 아이콘 */}
      <div className="aspect-video bg-muted rounded mb-3 flex items-center justify-center overflow-hidden">
        {!imageError ? (
          <LazyImage
            src={
              group.type === 'image'
                ? `${API_URL}/api/media${encodeURI(file.relativePath)}`
                : `${API_URL}/api/thumbnail?path=${encodeURIComponent(file.relativePath)}`
            }
            alt={file.name}
            width={200}
            height={150}
            className="object-cover w-full h-full"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-center">
            {group.type === 'image' ? (
              <>
                <svg
                  className="w-12 h-12 text-muted-foreground mb-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <p className="text-xs text-muted-foreground">
                  이미지 로드 실패
                </p>
              </>
            ) : (
              <>
                <svg
                  className="w-12 h-12 text-purple-500 mb-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <p className="text-xs text-muted-foreground">동영상 썸네일</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* 파일 정보 */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm truncate" title={file.name}>
          {file.name}
        </h4>
        <p className="text-xs text-muted-foreground truncate" title={file.path}>
          {file.path}
        </p>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatFileSize(file.size)}</span>
          <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* 선택 표시 */}
      {isSelected && (
        <div className="mt-2 text-center">
          <Badge variant="destructive">삭제 예정</Badge>
        </div>
      )}
    </div>
  )
}
