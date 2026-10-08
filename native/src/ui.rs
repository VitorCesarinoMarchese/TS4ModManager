use crate::catalog::Catalog;
use crate::catalog::EntryId;
use egui::{Color32, RichText};
use std::path::PathBuf;
use ts4_mod_manager_core::path_detection::GameInstance;

fastframe_icons::icons! {
    pub enum Icon {
        prefix: "ts4-native-",
        directory: "../icons/",
        Search => lucide "search",
        Refresh => lucide "refresh-cw",
        Moon => lucide "moon",
        Sun => lucide "sun",
        Back => lucide "arrow-left",
        Copy => lucide "copy",
        Folder => "folder",
        File => "file",
        Check => lucide "check",
    }
}

pub fn setup(ctx: &egui::Context) {
    egui_extras::install_image_loaders(ctx);
    fastframe_icons::install::<Icon>(ctx);
    let mut fonts = fastframe_fonts::FontSetup::default().definitions();
    let rendering = fastframe_text::detect();
    rendering.apply_to(&mut fonts);
    ctx.set_fonts(fonts);
    ctx.all_styles_mut(|style| {
        let dark = style.visuals.dark_mode;
        style.visuals.panel_fill = if dark {
            Color32::from_rgb(21, 23, 28)
        } else {
            Color32::from_rgb(248, 250, 252)
        };
        style.visuals.extreme_bg_color = if dark {
            Color32::from_rgb(28, 31, 36)
        } else {
            Color32::WHITE
        };
        style.visuals.override_text_color = Some(if dark {
            Color32::from_rgb(248, 250, 252)
        } else {
            Color32::from_rgb(2, 6, 23)
        });
        style.visuals.selection.bg_fill = if dark {
            Color32::from_rgb(10, 70, 54)
        } else {
            Color32::from_rgb(209, 250, 229)
        };
        style.visuals.selection.stroke.color = if dark {
            Color32::from_rgb(110, 231, 183)
        } else {
            Color32::from_rgb(6, 95, 70)
        };
        style.spacing.item_spacing = egui::vec2(10.0, 8.0);
        style.spacing.button_padding = egui::vec2(12.0, 8.0);
        style.spacing.interact_size.y = 34.0;
        style.visuals.widgets.noninteractive.bg_stroke.color = if dark {
            Color32::from_rgb(53, 58, 66)
        } else {
            Color32::from_rgb(220, 225, 231)
        };
        style.visuals.widgets.noninteractive.fg_stroke.color = if dark {
            Color32::from_rgb(170, 179, 190)
        } else {
            Color32::from_rgb(85, 97, 112)
        };
        for widget in [
            &mut style.visuals.widgets.inactive,
            &mut style.visuals.widgets.hovered,
            &mut style.visuals.widgets.active,
        ] {
            widget.corner_radius = egui::CornerRadius::same(6);
        }
        style.visuals.widgets.inactive.weak_bg_fill = if dark {
            Color32::from_rgb(39, 43, 50)
        } else {
            Color32::from_rgb(237, 241, 245)
        };
        rendering.apply_to_visuals(&mut style.visuals);
    });
}

#[derive(Default)]
pub struct View {
    pub root_input: String,
    pub instances: Vec<GameInstance>,
    pub scan_ms: Option<f64>,
    pub stats: RenderStats,
    detail_only: bool,
    editing_root: bool,
    copied: Option<(EntryId, f64)>,
    previews: crate::preview::Previews,
}

#[derive(Default)]
pub struct RenderStats {
    pub rows: usize,
    pub files: usize,
    pub search: Option<egui::Rect>,
    pub first_row: Option<egui::Rect>,
    pub back: Option<egui::Rect>,
    pub copy: Option<egui::Rect>,
    pub photos: usize,
    pub missing_photos: usize,
}

impl View {
    pub fn show(&mut self, ui: &mut egui::Ui, catalog: &mut Catalog) -> Option<PathBuf> {
        self.previews.begin_frame(ui.ctx(), catalog.generation());
        self.stats = RenderStats::default();
        let mut scan_root = None;
        let narrow = ui.available_width() < 900.0;
        let foreground = ui.visuals().text_color();
        egui::Panel::top("catalog-header")
            .resizable(false)
            .frame(
                egui::Frame::new()
                    .fill(ui.visuals().panel_fill)
                    .inner_margin(egui::Margin::symmetric(24, 16)),
            )
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Sims 4 Mod Manager").size(22.0).strong());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        let dark = ui.visuals().dark_mode;
                        let icon = if dark { Icon::Sun } else { Icon::Moon };
                        let label = if dark { "Light" } else { "Dark" };
                        if ui
                            .add(egui::Button::image_and_text(
                                icon.image(foreground, 16.0),
                                label,
                            ))
                            .clicked()
                        {
                            ui.ctx().set_theme(if dark {
                                egui::Theme::Light
                            } else {
                                egui::Theme::Dark
                            });
                        }
                    });
                });
                ui.add_space(14.0);
                ui.horizontal(|ui| {
                    ui.add(Icon::Folder.image(ui.visuals().weak_text_color(), 18.0));
                    match catalog.root.as_ref().filter(|_| !self.editing_root) {
                        None => {
                            let response = ui.add_sized(
                                [(ui.available_width() - 80.0).max(100.0), 36.0],
                                egui::TextEdit::singleline(&mut self.root_input)
                                    .hint_text("Game folder containing Mods")
                                    .margin(egui::vec2(10.0, 9.0)),
                            );
                            let enter = response.lost_focus()
                                && ui.input(|input| input.key_pressed(egui::Key::Enter));
                            if ui.button("Open").clicked() || enter {
                                let value = self.root_input.trim();
                                if !value.is_empty() {
                                    scan_root = Some(PathBuf::from(value));
                                    self.editing_root = false;
                                }
                            }
                        }
                        Some(root) => {
                            let path = root.to_string_lossy();
                            let tail: String = path
                                .chars()
                                .rev()
                                .take(64)
                                .collect::<String>()
                                .chars()
                                .rev()
                                .collect();
                            let display = if tail.len() < path.len() {
                                format!("…{tail}")
                            } else {
                                tail
                            };
                            ui.allocate_ui_with_layout(
                                egui::vec2((ui.available_width() - 130.0).max(100.0), 34.0),
                                egui::Layout::left_to_right(egui::Align::Center),
                                |ui| {
                                    ui.add(
                                        egui::Label::new(
                                            RichText::new(display)
                                                .color(ui.visuals().weak_text_color()),
                                        )
                                        .truncate(),
                                    )
                                    .on_hover_text(path.as_ref());
                                },
                            );
                            if ui.button("Change folder").clicked() {
                                self.root_input = path.into_owned();
                                self.editing_root = true;
                            }
                        }
                    }
                });
                if (self.editing_root || catalog.root.is_none()) && !self.instances.is_empty() {
                    egui::ComboBox::from_id_salt("instances")
                        .selected_text("Detected game folders")
                        .show_ui(ui, |ui| {
                            for instance in &self.instances {
                                let label = instance.path.to_string_lossy();
                                if ui
                                    .selectable_label(
                                        catalog.root.as_ref() == Some(&instance.path),
                                        label.as_ref(),
                                    )
                                    .clicked()
                                {
                                    self.root_input = label.into_owned();
                                    scan_root = Some(instance.path.clone());
                                    self.editing_root = false;
                                }
                            }
                        });
                }
            });

        egui::Panel::bottom("catalog-status")
            .resizable(false)
            .frame(
                egui::Frame::new()
                    .fill(ui.visuals().panel_fill)
                    .inner_margin(egui::Margin::symmetric(24, 10)),
            )
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.label(
                        RichText::new("Read-only pilot")
                            .size(12.0)
                            .color(ui.visuals().weak_text_color()),
                    );
                    ui.separator();
                    if catalog.loading {
                        ui.spinner();
                        ui.label(RichText::new("Scanning your Mods folder...").size(12.0));
                    } else if let Some(ms) = self.scan_ms {
                        ui.label(
                            RichText::new(format!(
                                "{} mods · scanned in {ms:.0} ms",
                                catalog.mods.len()
                            ))
                            .size(12.0)
                            .color(ui.visuals().weak_text_color()),
                        );
                    } else {
                        ui.label(
                            RichText::new("Choose a game folder to browse your mods.").size(12.0),
                        );
                    }
                });
            });

        if !narrow {
            egui::Panel::right("mod-details")
                .default_size(350.0)
                .min_size(280.0)
                .max_size(480.0)
                .frame(
                    egui::Frame::new()
                        .fill(ui.visuals().extreme_bg_color)
                        .inner_margin(24),
                )
                .show(ui, |ui| {
                    self.details(ui, catalog);
                });
        }

        egui::CentralPanel::default().frame(egui::Frame::new().fill(ui.visuals().panel_fill).inner_margin(24))
            .show(ui, |ui| {
                if let Some(error) = &catalog.error {
                    ui.colored_label(ui.visuals().error_fg_color, error);
                    ui.label("Check that the game folder exists and contains a readable Mods folder, then open it again.");
                    ui.add_space(16.0);
                }
                if narrow && self.detail_only && catalog.selected_mod().is_some() {
                    let back = ui.add(egui::Button::image_and_text(Icon::Back.image(foreground, 16.0), "Back to mods"));
                    self.stats.back = Some(back.rect);
                    if back.clicked() {
                        self.detail_only = false;
                    }
                    ui.add_space(16.0);
                    self.details(ui, catalog);
                    return;
                }
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Your mods").size(24.0).strong());
                    ui.label(RichText::new(format!("{}", catalog.mods.len())).size(14.0).color(ui.visuals().weak_text_color()));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.add_enabled(catalog.root.is_some() && !catalog.loading,
                            egui::Button::image_and_text(Icon::Refresh.image(foreground, 16.0), "Rescan")).clicked() {
                            scan_root = catalog.root.clone();
                        }
                    });
                });
                ui.add_space(12.0);
                egui::Frame::new()
                    .fill(ui.visuals().extreme_bg_color)
                    .stroke(ui.visuals().widgets.noninteractive.bg_stroke)
                    .corner_radius(8)
                    .inner_margin(egui::Margin::symmetric(12, 0))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.add(Icon::Search.image(ui.visuals().weak_text_color(), 18.0));
                            let mut query = catalog.query.clone();
                            let response = ui.add_sized(
                                [ui.available_width(), 40.0],
                                egui::TextEdit::singleline(&mut query)
                                    .hint_text("Search mods or filenames")
                                    .frame(egui::Frame::NONE.inner_margin(egui::Margin::symmetric(0, 11))),
                            );
                            self.stats.search = Some(response.rect);
                            if response.changed() { catalog.search(query); }
                        });
                    });
                ui.add_space(16.0);
                if !catalog.query.is_empty() {
                    ui.label(RichText::new(format!("{} matching mods", catalog.visible.len())).size(12.0).color(ui.visuals().weak_text_color()));
                }
                if catalog.visible.is_empty() {
                    ui.add_space(32.0);
                    let (title, message) = if catalog.loading {
                        ("Reading your catalog", "You can keep using the window while the scan runs.")
                    } else if catalog.root.is_none() {
                        ("Start with your game folder", "Open the Sims 4 folder containing Mods, or choose a detected game folder above.")
                    } else if !catalog.query.is_empty() {
                        ("No matching mods", "Try another name or filename, or clear your search.")
                    } else {
                        ("No mods found", "This folder has no package or script mods. Managed mods also appear here when stored locally.")
                    };
                    ui.heading(title); ui.label(message);
                    return;
                }
                let root_id = catalog.root.clone();
                egui::ScrollArea::vertical().id_salt(("catalog", root_id)).auto_shrink([false, false])
                    .show_rows(ui, 64.0, catalog.visible.len(), |ui, range| {
                        for visible_index in range {
                            let index = catalog.visible[visible_index];
                            let entry = &catalog.mods[index];
                            let identity = EntryId::of(entry);
                            let origin = match entry.source {
                                ts4_mod_manager_core::mod_scan::ModSource::Managed => "Managed",
                                ts4_mod_manager_core::mod_scan::ModSource::External => "External",
                            };
                            let state = if entry.enabled { "Installed" } else { "Stored" };
                            let count = entry.mod_files.len();
                            let subtitle = format!("{origin} · {count} {}", if count == 1 { "mod file" } else { "mod files" });
                            let selected = catalog.selected.as_ref() == Some(&identity);
                            let response = ui.push_id(identity, |ui| {
                                let (rect, response) = ui.allocate_exact_size(egui::vec2(ui.available_width(), 64.0), egui::Sense::click());
                                let visuals = ui.style().interact_selectable(&response, selected);
                                if selected || response.hovered() || response.has_focus() {
                                    ui.painter().rect_filled(rect, 6.0, visuals.bg_fill);
                                }
                                let inner = rect.shrink2(egui::vec2(12.0, 10.0));
                                let thumbnail = egui::Rect::from_min_size(inner.min, egui::Vec2::splat(44.0));
                                self.paint_preview(ui, entry.preview.as_deref(), catalog.root.as_deref(), thumbnail, true);
                                let mut row = ui.new_child(egui::UiBuilder::new()
                                    .max_rect(egui::Rect::from_min_max(egui::pos2(inner.left() + 56.0, inner.top()), egui::pos2(inner.right() - 92.0, inner.bottom())))
                                    .layout(egui::Layout::top_down(egui::Align::Min)));
                                row.spacing_mut().item_spacing.y = 5.0;
                                row.add(egui::Label::new(RichText::new(&entry.name).size(15.0).color(foreground)).truncate());
                                let secondary = if selected { ui.visuals().selection.stroke.color } else { ui.visuals().weak_text_color() };
                                row.add(egui::Label::new(RichText::new(subtitle).size(12.0).color(secondary)).truncate());
                                let mut status = ui.new_child(egui::UiBuilder::new()
                                    .max_rect(egui::Rect::from_min_max(egui::pos2(inner.right() - 84.0, inner.top()), inner.max))
                                    .layout(egui::Layout::right_to_left(egui::Align::Center)));
                                status.label(RichText::new(state).size(12.0).color(secondary));
                                response.widget_info(|| egui::WidgetInfo::selected(egui::WidgetType::SelectableLabel, ui.is_enabled(), selected, &entry.name));
                                response.on_hover_text(&entry.name)
                            }).inner;
                            if self.stats.first_row.is_none() { self.stats.first_row = Some(response.rect); }
                            self.stats.rows += 1;
                            if response.clicked() {
                                catalog.select(index);
                                self.detail_only = narrow;
                            }
                        }
                    });
            });
        scan_root
    }

    fn details(&mut self, ui: &mut egui::Ui, catalog: &Catalog) {
        let Some(entry) = catalog.selected_mod() else {
            ui.add_space(24.0);
            ui.heading("Select a mod");
            ui.label("Its files and saved source details will appear here.");
            return;
        };
        egui::ScrollArea::vertical()
            .id_salt(("detail-summary", EntryId::of(entry)))
            .max_height((ui.available_height() - 150.0).max(80.0))
            .auto_shrink([false, true])
            .show(ui, |ui| {
                ui.add(egui::Label::new(RichText::new(&entry.name).size(23.0).strong()).wrap());
                ui.add_space(12.0);
                let state = if entry.enabled {
                    "Installed in this game folder"
                } else {
                    "Stored in managed storage"
                };
                egui::Frame::new()
                    .fill(ui.visuals().widgets.inactive.weak_bg_fill)
                    .corner_radius(6)
                    .inner_margin(egui::Margin::symmetric(10, 7))
                    .show(ui, |ui| {
                        ui.label(
                            RichText::new(state)
                                .size(12.0)
                                .color(ui.visuals().weak_text_color()),
                        );
                    });
                ui.add_space(24.0);
                let (photo, response) = ui.allocate_exact_size(
                    egui::vec2(ui.available_width(), 180.0),
                    egui::Sense::hover(),
                );
                self.paint_preview(
                    ui,
                    entry.preview.as_deref(),
                    catalog.root.as_deref(),
                    photo,
                    false,
                );
                response.widget_info(|| {
                    egui::WidgetInfo::labeled(
                        egui::WidgetType::Image,
                        ui.is_enabled(),
                        format!("Preview of {}", entry.name),
                    )
                });
                ui.add_space(24.0);
                if let Some(source) = &entry.source_url {
                    ui.label(RichText::new("Saved source").size(14.0).strong());
                    if let Some(attachment) = &entry.source_attachment {
                        if let Some(author) = &attachment.author {
                            ui.label(
                                RichText::new(author)
                                    .size(13.0)
                                    .color(ui.visuals().weak_text_color()),
                            );
                        }
                        if attachment
                            .confidence
                            .is_some_and(|confidence| confidence < 70)
                        {
                            ui.label("Low confidence. Verify this source before relying on it.");
                        }
                    }
                    ui.add(
                        egui::Label::new(
                            RichText::new(source)
                                .size(12.0)
                                .color(ui.visuals().weak_text_color()),
                        )
                        .selectable(true)
                        .wrap(),
                    );
                    ui.add_space(24.0);
                }
            });
        ui.add_space(12.0);
        ui.separator();
        ui.add_space(12.0);
        let identity = EntryId::of(entry);
        let now = ui.input(|input| input.time);
        let copied = self
            .copied
            .as_ref()
            .is_some_and(|(id, until)| *id == identity && now < *until);
        ui.horizontal(|ui| {
            ui.label(RichText::new("Files").size(16.0).strong());
            ui.label(
                RichText::new(format!("{}", entry.files.len()))
                    .size(13.0)
                    .color(ui.visuals().weak_text_color()),
            );
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let icon = if copied { Icon::Check } else { Icon::Copy };
                let copy = ui.add(egui::Button::image_and_text(
                    icon.image(ui.visuals().text_color(), 14.0),
                    if copied { "Copied" } else { "Copy" },
                ));
                self.stats.copy = Some(copy.rect);
                if copy.clicked() {
                    ui.ctx().copy_text(entry.files.join("\n"));
                    self.copied = Some((identity.clone(), now + 2.0));
                    ui.ctx()
                        .request_repaint_after(std::time::Duration::from_secs(2));
                }
            });
        });
        ui.add_space(12.0);
        egui::ScrollArea::vertical()
            .id_salt(("files", catalog.root.clone(), identity))
            .auto_shrink([false, false])
            .show_rows(ui, 48.0, entry.files.len(), |ui, range| {
                for index in range {
                    let file = &entry.files[index];
                    let (parent, basename) = file.rsplit_once(['/', '\\']).unwrap_or(("", file));
                    let (rect, _) = ui.allocate_exact_size(
                        egui::vec2(ui.available_width(), 48.0),
                        egui::Sense::hover(),
                    );
                    let mut row = ui.new_child(
                        egui::UiBuilder::new()
                            .max_rect(rect)
                            .layout(egui::Layout::left_to_right(egui::Align::Min)),
                    );
                    row.add(Icon::File.image(ui.visuals().weak_text_color(), 16.0));
                    row.vertical(|ui| {
                        ui.spacing_mut().item_spacing.y = 4.0;
                        ui.add(
                            egui::Label::new(RichText::new(basename).size(13.0))
                                .truncate()
                                .selectable(true),
                        )
                        .on_hover_text(file);
                        if !parent.is_empty() {
                            ui.add(
                                egui::Label::new(
                                    RichText::new(parent)
                                        .size(11.0)
                                        .color(ui.visuals().weak_text_color()),
                                )
                                .truncate(),
                            )
                            .on_hover_text(file);
                        }
                    });
                    self.stats.files += 1;
                }
            });
    }

    fn paint_preview(
        &mut self,
        ui: &egui::Ui,
        preview: Option<&str>,
        root: Option<&std::path::Path>,
        rect: egui::Rect,
        thumbnail: bool,
    ) {
        ui.painter()
            .rect_filled(rect, 6.0, ui.visuals().widgets.inactive.weak_bg_fill);
        match self.previews.load(ui.ctx(), preview, root) {
            crate::preview::State::Ready(texture) => {
                let image = egui::Image::new(texture).corner_radius(6);
                if thumbnail {
                    let aspect = texture.size.x / texture.size.y;
                    let crop = if aspect > 1.0 {
                        egui::vec2(1.0 / aspect, 1.0)
                    } else {
                        egui::vec2(1.0, aspect)
                    };
                    let uv = egui::Rect::from_center_size(egui::pos2(0.5, 0.5), crop);
                    image.uv(uv).paint_at(ui, rect);
                } else {
                    let scale = (rect.width() / texture.size.x).min(rect.height() / texture.size.y);
                    image.paint_at(
                        ui,
                        egui::Rect::from_center_size(rect.center(), texture.size * scale),
                    );
                }
                self.stats.photos += 1;
            }
            crate::preview::State::Pending => {
                egui::Spinner::new().size(18.0).paint_at(
                    ui,
                    egui::Rect::from_center_size(rect.center(), egui::Vec2::splat(18.0)),
                );
            }
            crate::preview::State::Missing => {
                ui.painter().text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    if thumbnail {
                        "No\nPreview"
                    } else {
                        "No Preview"
                    },
                    egui::FontId::proportional(if thumbnail { 9.0 } else { 14.0 }),
                    ui.visuals().weak_text_color(),
                );
                self.stats.missing_photos += 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn populated_catalog() -> Catalog {
        let entries = (0..10_000).map(|index| serde_json::from_value(serde_json::json!({
            "key": format!("Mod{index:05}"), "name": format!("Mod{index:05}"),
            "files": (0..if index == 0 { 10_000 } else { 1 }).map(|n| format!("file{n}.package")).collect::<Vec<_>>(),
            "mod_files": ["file0.package"], "source": "external", "enabled": true, "group_path": ["Pack"]
        })).expect("entry")).collect();
        let mut catalog = Catalog::default();
        let generation = catalog.begin_scan("/fixture/The Sims 4".into());
        catalog.accept_scan(generation, Ok(entries));
        catalog.select(0);
        catalog
    }

    fn render(
        ctx: &egui::Context,
        view: &mut View,
        catalog: &mut Catalog,
        events: Vec<egui::Event>,
        width: f32,
    ) -> egui::FullOutput {
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::vec2(width, 800.0),
            )),
            events,
            ..Default::default()
        };
        let mut output = ctx.run_ui(input, |ui| {
            view.show(ui, catalog);
        });
        output.textures_delta.clear();
        output
    }

    #[test]
    fn large_catalog_and_file_details_only_render_visible_rows() {
        let mut catalog = populated_catalog();
        let mut view = View::default();
        let ctx = egui::Context::default();
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        assert!(view.stats.rows > 0 && view.stats.rows < 30);
        assert!(view.stats.files > 0 && view.stats.files < 40);
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        assert!(view.stats.rows < 30);
    }

    #[test]
    fn photo_is_painted_in_catalog_and_details_with_fallback_when_missing() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("preview.png");
        image::RgbaImage::from_pixel(80, 40, image::Rgba([10, 100, 80, 255]))
            .save(&path)
            .unwrap();
        let mut catalog = populated_catalog();
        catalog.mods[0].preview = Some(path.to_string_lossy().into_owned());
        let ctx = egui::Context::default();
        setup(&ctx);
        let mut cache = crate::preview::Previews::default();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        let texture = loop {
            if let crate::preview::State::Ready(texture) = cache.load(&ctx, path.to_str(), None) {
                break texture;
            }
            assert!(std::time::Instant::now() < deadline, "photo did not load");
            std::thread::sleep(std::time::Duration::from_millis(5));
        };
        let mut view = View::default();
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        let output = render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        let photos = output
            .shapes
            .iter()
            .filter(|shape| shape.shape.texture_id() == texture.id)
            .count();
        assert!(
            photos >= 2,
            "expected thumbnail and detail photo, got {photos}"
        );
        catalog.mods[0].preview = None;
        let output = render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        assert!(output.shapes.iter().any(|shape| matches!(&shape.shape, egui::epaint::Shape::Text(text) if text.galley.text() == "No Preview")));
    }

    #[test]
    fn search_has_a_comfortable_input_target_in_both_layouts() {
        for width in [680.0, 940.0, 1200.0] {
            let mut catalog = populated_catalog();
            let mut view = View::default();
            let ctx = egui::Context::default();
            setup(&ctx);
            render(&ctx, &mut view, &mut catalog, vec![], width);
            render(&ctx, &mut view, &mut catalog, vec![], width);
            let search = view.stats.search.expect("search");
            assert!(search.height() >= 36.0, "search too short: {search:?}");
            assert!(search.right() <= width, "search outside window");
        }
    }

    #[test]
    fn narrow_details_return_to_catalog_and_copy_full_paths() {
        let mut catalog = populated_catalog();
        let mut view = View::default();
        let ctx = egui::Context::default();
        setup(&ctx);
        let click = |pos| {
            vec![
                egui::Event::PointerMoved(pos),
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: true,
                    modifiers: Default::default(),
                },
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: Default::default(),
                },
            ]
        };
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        let row = view.stats.first_row.expect("row").center();
        render(&ctx, &mut view, &mut catalog, click(row), 680.0);
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        assert!(view.stats.rows == 0 && view.stats.files > 0);
        let copy = view.stats.copy.expect("copy").center();
        let output = render(&ctx, &mut view, &mut catalog, click(copy), 680.0);
        assert!(output.platform_output.commands.iter().any(|command| matches!(
            command, egui::OutputCommand::CopyText(text) if *text == catalog.selected_mod().unwrap().files.join("\n")
        )));
        assert!(view.copied.is_some());
        let back = view.stats.back.expect("back").center();
        render(&ctx, &mut view, &mut catalog, click(back), 680.0);
        render(&ctx, &mut view, &mut catalog, vec![], 680.0);
        assert!(view.stats.rows > 0 && view.stats.files == 0);
    }

    #[test]
    fn real_search_widget_filters_catalog_after_keyboard_input() {
        let mut catalog = populated_catalog();
        let mut view = View::default();
        let ctx = egui::Context::default();
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        render(&ctx, &mut view, &mut catalog, vec![], 1200.0);
        let pos = view.stats.search.expect("search").center();
        render(
            &ctx,
            &mut view,
            &mut catalog,
            vec![
                egui::Event::PointerMoved(pos),
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: true,
                    modifiers: Default::default(),
                },
                egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: Default::default(),
                },
            ],
            1200.0,
        );
        render(
            &ctx,
            &mut view,
            &mut catalog,
            vec![egui::Event::Text("Mod00042".into())],
            1200.0,
        );
        assert_eq!(catalog.visible.len(), 1);
        assert_eq!(catalog.mods[catalog.visible[0]].name, "Mod00042");
    }
}
