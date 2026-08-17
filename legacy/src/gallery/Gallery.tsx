import { Box, ImageList, ImageListItem, ImageListItemBar, Typography } from "@mui/material";
import React from "react";
import { Project } from "../types";
import { Link } from "react-router-dom";
import './gallery.css';

type Props = {
  projects: Project[];
};

type GalleryCardProps = Project;

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

const GalleryCard: React.FC<GalleryCardProps> = ({
  id,
  title,
  description,
  importance,
  route,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const listItemProps = getSizeProps(importance);

  return (
    <ImageListItem
      {...listItemProps}
      component={Link}
      to={route}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        cursor: "pointer",
        border: "1px solid white",
        textDecoration: "none",
        color: "inherit",
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

const Gallery: React.FC<Props> = ({ projects }) => {
  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        overflow: "auto",
        padding: 2,
      }}
    >
      <Typography variant="h3" sx={{ mb: 2 }}>Goofy Projects...</Typography>
      <ImageList
        cols={4}
        gap={10}
      >
        {projects.map((project, i) => (
          <GalleryCard key={i} {...project} />
        ))}
      </ImageList>
    </Box>
  );
};

export default Gallery;
export type { Project };
