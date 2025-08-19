'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Label,
  Slider,
  Switch,
  Separator,
} from '@repo/ui'
import { Settings, ChevronDown, ChevronUp, RotateCcw, Info } from 'lucide-react'
import { SimilarityThresholds, ThresholdPreset } from '@/types'
import {
  THRESHOLD_PRESETS,
  DEFAULT_THRESHOLDS,
  calculateComplexity,
} from '@/lib/threshold-presets'

interface ThresholdSettingsProps {
  thresholds: SimilarityThresholds
  onThresholdsChange: (thresholds: SimilarityThresholds) => void
  className?: string
}

export function ThresholdSettings({
  thresholds,
  onThresholdsChange,
  className = '',
}: ThresholdSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const complexity = calculateComplexity(thresholds)

  const applyPreset = (preset: ThresholdPreset) => {
    onThresholdsChange(preset.thresholds)
    setSelectedPreset(preset.name)
  }

  const resetToDefaults = () => {
    onThresholdsChange(DEFAULT_THRESHOLDS)
    setSelectedPreset('균형')
  }

  const updateThreshold = (path: string, value: any) => {
    const newThresholds = JSON.parse(JSON.stringify(thresholds))
    const keys = path.split('.')
    let current = newThresholds

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value

    onThresholdsChange(newThresholds)
    setSelectedPreset(null) // 커스텀 설정으로 변경
  }

  const getComplexityColor = (complexity: number) => {
    if (complexity <= 20) return 'bg-red-500'
    if (complexity <= 40) return 'bg-orange-500'
    if (complexity <= 60) return 'bg-yellow-500'
    if (complexity <= 80) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getComplexityLabel = (complexity: number) => {
    if (complexity <= 20) return '매우 엄격'
    if (complexity <= 40) return '엄격'
    if (complexity <= 60) return '균형'
    if (complexity <= 80) return '관대'
    return '매우 관대'
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            유사도 임계값 설정
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${getComplexityColor(complexity)}`}
              />
              {getComplexityLabel(complexity)} ({complexity}%)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              기본값
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 프리셋 선택 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">빠른 설정 프리셋</Label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {THRESHOLD_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant={selectedPreset === preset.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-2 h-auto p-3"
              >
                <span className="text-lg">{preset.icon}</span>
                <div className="text-left">
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {preset.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* 고급 설정 토글 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">고급 설정</Label>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1"
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-4 w-4" />
                숨기기
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                표시
              </>
            )}
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-6 pt-2">
            {/* 이미지 설정 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">🖼️ 이미지 설정</Label>
                {thresholds.image.exact && (
                  <Badge variant="secondary" className="text-xs">
                    정확한 중복만
                  </Badge>
                )}
              </div>

              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">정확한 중복만 검사</Label>
                  <Switch
                    checked={thresholds.image.exact}
                    onCheckedChange={(checked) =>
                      updateThreshold('image.exact', checked)
                    }
                  />
                </div>

                {!thresholds.image.exact && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">시각적 유사도</Label>
                      <Badge variant="outline">
                        {thresholds.image.perceptual}%
                      </Badge>
                    </div>
                    <Slider
                      value={[thresholds.image.perceptual]}
                      onValueChange={([value]) =>
                        updateThreshold('image.perceptual', value)
                      }
                      max={100}
                      min={50}
                      step={5}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      높을수록 더 유사한 이미지만 중복으로 인식
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 비디오 설정 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">🎥 비디오 설정</Label>
                {thresholds.video.exact && (
                  <Badge variant="secondary" className="text-xs">
                    정확한 중복만
                  </Badge>
                )}
              </div>

              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">정확한 중복만 검사</Label>
                  <Switch
                    checked={thresholds.video.exact}
                    onCheckedChange={(checked) =>
                      updateThreshold('video.exact', checked)
                    }
                  />
                </div>

                {!thresholds.video.exact && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">시각적 유사도</Label>
                        <Badge variant="outline">
                          {thresholds.video.visual}%
                        </Badge>
                      </div>
                      <Slider
                        value={[thresholds.video.visual]}
                        onValueChange={([value]) =>
                          updateThreshold('video.visual', value)
                        }
                        max={100}
                        min={30}
                        step={5}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">
                        비디오 프레임 간 시각적 유사도 임계값
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">길이 유사도</Label>
                        <Badge variant="outline">
                          {thresholds.video.duration}%
                        </Badge>
                      </div>
                      <Slider
                        value={[thresholds.video.duration]}
                        onValueChange={([value]) =>
                          updateThreshold('video.duration', value)
                        }
                        max={100}
                        min={5}
                        step={5}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground">
                        비디오 길이가 최소 이 비율만큼 유사해야 함
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 전역 설정 */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">⚙️ 전역 설정</Label>

              <div className="space-y-3 pl-4 border-l-2 border-muted">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">작은 파일 제외</Label>
                  <Switch
                    checked={thresholds.global.skipSmallFiles}
                    onCheckedChange={(checked) =>
                      updateThreshold('global.skipSmallFiles', checked)
                    }
                  />
                </div>

                {thresholds.global.skipSmallFiles && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">최소 파일 크기</Label>
                      <Badge variant="outline">
                        {thresholds.global.minFileSize < 1024
                          ? `${thresholds.global.minFileSize}B`
                          : thresholds.global.minFileSize < 1024 * 1024
                            ? `${Math.round(thresholds.global.minFileSize / 1024)}KB`
                            : `${Math.round(thresholds.global.minFileSize / 1024 / 1024)}MB`}
                      </Badge>
                    </div>
                    <Slider
                      value={[
                        Math.log10(Math.max(1, thresholds.global.minFileSize)),
                      ]}
                      onValueChange={([value]) =>
                        updateThreshold(
                          'global.minFileSize',
                          Math.round(Math.pow(10, value))
                        )
                      }
                      max={7} // 10MB
                      min={0} // 1B
                      step={0.1}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      이보다 작은 파일은 중복 검사에서 제외
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
