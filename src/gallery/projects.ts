export type ArtworkVariant = 'orbit' | 'frames' | 'waves' | 'intro'

export interface GalleryProject {
  id: string
  index: string
  title: string
  description: string
  route: string
  artwork: ArtworkVariant
  isIntro?: boolean
}

export const galleryProjects = [
  {
    id: 'experiment-01',
    index: '01',
    title: 'Experiment 01',
    description: 'A small machine pretending it knows what it is doing.',
    route: '/gallery/experiment-01',
    artwork: 'orbit',
  },
  {
    id: 'experiment-02',
    index: '02',
    title: 'Experiment 02',
    description: 'Something is moving. That is probably a good sign.',
    route: '/gallery/experiment-02',
    artwork: 'frames',
  },
  {
    id: 'experiment-03',
    index: '03',
    title: 'Experiment 03',
    description: 'Please do not tap the glass.',
    route: '/gallery/experiment-03',
    artwork: 'waves',
  },
  {
    id: 'intro',
    index: '04',
    title: 'Intro',
    description: 'Back to where the nonsense begins.',
    route: '/',
    artwork: 'intro',
    isIntro: true,
  },
] as const satisfies readonly GalleryProject[]

export type ProjectId = (typeof galleryProjects)[number]['id']
export type PlaceholderProject = Exclude<
  (typeof galleryProjects)[number],
  { isIntro: true }
>

export function getPlaceholderProject(pathname: string) {
  return galleryProjects.find(
    (project): project is PlaceholderProject =>
      !('isIntro' in project) && project.route === pathname,
  )
}
