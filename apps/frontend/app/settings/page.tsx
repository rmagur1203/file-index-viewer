'use client'

import React from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Video,
  Image,
  Palette,
  Monitor,
  Volume2,
  Eye,
  RotateCcw,
  FileText,
  Grid3X3,
  List,
} from 'lucide-react'

const SettingsPage = () => {
  const { settings, updateSetting, resetSettings } = useSettings()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">설정</h1>
        </div>
        <p className="text-muted-foreground">
          파일 브라우저의 동작과 모양을 사용자 정의하세요.
        </p>
      </div>

      <Separator />

      {/* 비디오 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-500" />
            비디오 설정
          </CardTitle>
          <CardDescription>비디오 재생 및 제어 관련 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoplay">자동 재생</Label>
              <div className="text-sm text-muted-foreground">
                비디오를 열면 자동으로 재생합니다
              </div>
            </div>
            <Switch
              id="autoplay"
              checked={settings.autoplayVideo}
              onCheckedChange={(checked) =>
                updateSetting('autoplayVideo', checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label>기본 볼륨</Label>
            <div className="space-y-2">
              <Slider
                value={[settings.videoVolume * 100]}
                onValueChange={(value) =>
                  updateSetting('videoVolume', value[0] / 100)
                }
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                {Math.round(settings.videoVolume * 100)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="controls">비디오 컨트롤 표시</Label>
              <div className="text-sm text-muted-foreground">
                재생, 일시정지 등의 컨트롤을 표시합니다
              </div>
            </div>
            <Switch
              id="controls"
              checked={settings.showVideoControls}
              onCheckedChange={(checked) =>
                updateSetting('showVideoControls', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 갤러리 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-green-500" />
            갤러리 및 보기 설정
          </CardTitle>
          <CardDescription>파일 목록 표시 방식과 썸네일 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>기본 보기 모드</Label>
            <Select
              value={settings.defaultViewMode}
              onValueChange={(value: 'list' | 'gallery') =>
                updateSetting('defaultViewMode', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    리스트 보기
                  </div>
                </SelectItem>
                <SelectItem value="gallery">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    갤러리 보기
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>썸네일 크기</Label>
            <Select
              value={settings.thumbnailSize}
              onValueChange={(value: 'small' | 'medium' | 'large') =>
                updateSetting('thumbnailSize', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">작게</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="large">크게</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="extensions">파일 확장자 표시</Label>
              <div className="text-sm text-muted-foreground">
                파일명에 확장자(.mp4, .jpg 등)를 표시합니다
              </div>
            </div>
            <Switch
              id="extensions"
              checked={settings.showFileExtensions}
              onCheckedChange={(checked) =>
                updateSetting('showFileExtensions', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 일반 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-purple-500" />
            일반 설정
          </CardTitle>
          <CardDescription>테마, 언어 및 기타 일반적인 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>테마</Label>
            <Select
              value={settings.theme}
              onValueChange={(value: 'light' | 'dark' | 'system') =>
                updateSetting('theme', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">라이트 모드</SelectItem>
                <SelectItem value="dark">다크 모드</SelectItem>
                <SelectItem value="system">시스템 설정 따라가기</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>언어</Label>
            <Select
              value={settings.language}
              onValueChange={(value: 'ko' | 'en') =>
                updateSetting('language', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="hidden">숨겨진 파일 표시</Label>
              <div className="text-sm text-muted-foreground">
                .으로 시작하는 숨겨진 파일을 표시합니다
              </div>
            </div>
            <Switch
              id="hidden"
              checked={settings.showHiddenFiles}
              onCheckedChange={(checked) =>
                updateSetting('showHiddenFiles', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 설정 초기화 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            설정 초기화
          </CardTitle>
          <CardDescription>
            모든 설정을 기본값으로 되돌립니다. 이 작업은 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={resetSettings}
            className="w-full"
          >
            모든 설정 초기화
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
