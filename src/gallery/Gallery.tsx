import { Box, ImageList, ImageListItem, ImageListItemBar, Typography } from "@mui/material";
import React from "react";
import { Project } from "../types";
import './gallery.css';

type Props = {
  projects: Project[];
  onClickProject: (id: string) => void;
};

type GalleryCardProps = Project & {
  onClick: () => void;
};

const getSizeProps = (importance: number) => {
  switch (importance) {
    case 1:
      return {
        cols: 1,
        rows: 1,
      };
    case 2:
      return {
        cols: 2,
        rows: 1,
      };
    case 3:
      return {
        cols: 2,
        rows: 2,
      };
    default:
      return {
        cols: 1,
        rows: 1,
      };
  }
};

const GalleryCard: React.FC<Project & { onClick: () => void }> = ({
  id,
  title,
  description,
  importance,
  onClick,
}: GalleryCardProps) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const listItemProps = getSizeProps(importance);

  return (
    <ImageListItem
      {...listItemProps}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        cursor: "pointer",
        border: "1px solid white",
      }}
    >
      <img
        src={`./media/${id}.png`}
        alt={title}
        style={{
          objectFit: "cover",
        }}
      />
      <ImageListItemBar
        title={title}
        subtitle={isHovered ? description : ""}
        classes={{
          subtitle: isHovered ? "typing-effect" : "",
        }}
      />
    </ImageListItem>
  );
};

const Gallery: React.FC<Props> = ({ projects, onClickProject }) => {
  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
      }}
    >
      <Typography variant="h3">Goofy Projects...</Typography>
      <ImageList
        cols={4}  
        gap={10}
        sx={{
          padding: 2
        }}
      >
        {projects.map((project, i) => (
          <GalleryCard key={i} {...project} onClick={() => onClickProject(project.id)} />
        ))}
      </ImageList>
    </Box>
  );
};

export default Gallery;
export type { Project };
