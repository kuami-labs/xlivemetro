// Package gtfs lit le GTFS d'Île-de-France Mobilités et le filtre sur le périmètre v1
// (métro, RER A à E, tram ; ADR 0010).
package gtfs

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Source donne accès aux fichiers d'un GTFS (archive zip ou dossier).
type Source interface {
	Open(name string) (io.ReadCloser, error)
	Close() error
}

// OpenSource ouvre un GTFS depuis un fichier .zip ou un dossier.
func OpenSource(path string) (Source, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return dirSource(path), nil
	}
	z, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("ouverture du zip %s : %w", path, err)
	}
	return zipSource{z}, nil
}

type dirSource string

func (d dirSource) Open(name string) (io.ReadCloser, error) {
	return os.Open(filepath.Join(string(d), name))
}

func (dirSource) Close() error { return nil }

type zipSource struct{ *zip.ReadCloser }

func (z zipSource) Open(name string) (io.ReadCloser, error) {
	return z.ReadCloser.Open(name)
}
