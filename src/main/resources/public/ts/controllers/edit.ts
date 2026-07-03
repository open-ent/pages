import { ng, sniplets, Behaviours, notify } from 'entcore';
import { template, idiom } from 'entcore';
import { Website, Cell, Page, Folders, Media, Rows, Blocks, Block } from '../model';
import { _ } from 'entcore';
import { Autosave } from 'entcore-toolkit';
import { $ } from 'entcore';
import http from 'axios';

export let edit = ng.controller('EditController', [
    '$scope', 'model', 'route', '$route', '$location', function ($scope, model, route, $route, $location) {
        let params = $route.current.params;
        const findPage = async (): Promise<void> => {
            let websites = await Folders.websites();
            let website: Website = websites.find((w) => w._id === params.siteId ||  w.slug === params.siteId);
            $scope.website = website;

            if (params.pageId) {
                $scope.page = website.pages.matchingPath(params.pageId, website, true);
            }
            else {
                $scope.page = website.pages.landingPage(website, true);
            }

            let page: Page = $scope.page;
            $scope.page.applySASS();

            website.watchChanges();
            $scope.websites = await Folders.websites();
            $scope.websites = $scope.websites.filter(w => !w.trashed);
            await Blocks.sync();
            $scope.blocks = Blocks;
            $scope.$apply();
        };

        model.on('route-changed', () => {
            Autosave.unwatchAll();
            params = $route.current.params;
            findPage();
        });

        template.open('view/grid', 'view/grid');
        template.open('editor/grid', 'editor/grid');

        $scope.media = [
            { type: 'sound' },
            { type: 'video' },
            { type: 'text' },
            { type: 'image' }
        ];

        $scope.updateNav = () => {
            model.trigger('refresh-nav');
        }

        $scope.currentVisibility = () => {
            if($scope.website.visibility !== 'PUBLIC'){
                return 'protected';
            }
            return $scope.website.visibility.toLowerCase();
        }

        $scope.snipletsSources = $scope.sniplets.map((s) => ({ 
                type: 'sniplet', 
                source: { application: s.application, template: s.template, title: s.sniplet.title } 
            })
        );

        $scope.publicSnipletsSources = _
            .filter($scope.sniplets, (s) => s.sniplet.public)
            .map((s) => ({
                type: 'sniplet',
                source: { application: s.application, template: s.template, title: s.sniplet.title }
            })
        );

        $scope.searchBlocks = (item: Block) => {
            return !$scope.display.searchBlocks || idiom.removeAccents(item.keywords.toLowerCase()).indexOf(
                idiom.removeAccents($scope.display.searchBlocks).toLowerCase()
            ) !== -1;
        };

        $scope.cellContent = (cell: Cell, content) => {
            cell.source(content);
        };

        $scope.dropContent = (row, cell, $item) => {
            cell.source($item);
            row.page.trigger('save');
        };

        $scope.canRemovePage = (page: Page) => {
            let isOwner = ($scope.website && $scope.website.owner && $scope.website.owner.userId ===  model.me.userId) ||  model.me.userId === page.owner;
            return isOwner || model.me.hasRight($scope.website, Behaviours.applicationsBehaviours.pages.rights.resource.manager);
        };

        $scope.removePage = () => {
            $scope.display.data.remove();
            $scope.lightbox('confirmRemovePage');
        };

        $scope.addPage = async () => {
            $scope.display.currentTemplate = undefined;
            let page = await $scope.website.useNewPage();
            $location.path('/website/' + $scope.website._id + '/' + page.titleLink)
            $scope.$apply();
        };

        $scope.previewPath = () => {
            if(!$scope.website){
                return '';
            }
            if ($scope.website.visibility === 'PUBLIC') {
                if (params.pageId) {
                    return '/pages/p/website#/preview/' + params.siteId + '/' + params.pageId;
                }
                else {
                    return '/pages/p/website#/preview/' + params.siteId;
                }
            }
            else {
                if (params.pageId) {
                    return '/pages#/preview/' + params.siteId + '/' + params.pageId;
                }
                else {
                    return '/pages#/preview/' + params.siteId;
                }
            }
        };

        $scope.focusEditor = (cell: Cell, $event) => {
            if(cell.focus){
                return;
            }
            cell.focus = true;
            let range = window.getSelection().getRangeAt(0);
            let startOffset = range.startOffset;
            let gridCell = $($event.target).parents('grid-cell');
            setTimeout(() => {
                gridCell.find('[contenteditable]')[0].focus();
                gridCell.find('[contenteditable]')[0].click();
                let e = document.createEvent("MouseEvent");
                let el: Node = document.elementFromPoint($event.clientX, $event.clientY);
                while(el && el.nodeType === 1){
                    el = el.firstChild;
                }
                let newRange = document.createRange();
                newRange.setStart(el, startOffset);
                newRange.setEnd(el, startOffset);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(newRange);
            }, 200);
        };

        $scope.applySASS = (page: Page) => {
            page.applySASS();
        };

        $scope.closeManagePages = () => {
            $scope.closeLightbox('managePages');
            $scope.website.newPage = undefined;
            $scope.website.showStyle = undefined;
        };

        // ─── CCTP 58B — Droits de modification par page ──────────────────────────
        // Restreint, page par page, les groupes/utilisateurs partagés du site autorisés
        // à modifier une page donnée. Vide = tous les contributeurs du site (comportement
        // historique).
        $scope.pageRights = { page: undefined, entries: [], loading: false };

        $scope.canManageRights = (page: Page) => {
            let isOwner = ($scope.website && $scope.website.owner && $scope.website.owner.userId === model.me.userId)
                || model.me.userId === page.owner;
            return isOwner || model.me.hasRight($scope.website, Behaviours.applicationsBehaviours.pages.rights.resource.manager);
        };

        $scope.openPageRights = async (page: Page) => {
            $scope.pageRights = { page: page, entries: [], loading: true };
            $scope.lightbox('pageRights');
            try {
                const res = await http.get('/pages/share/json/' + $scope.website._id);
                const data = res.data || {};
                const selected = page.contrib || [];
                const entries = [];
                const groups = (data.groups && data.groups.visibles) || [];
                const gChecked = (data.groups && data.groups.checked) || {};
                groups.forEach((g) => {
                    if (gChecked[g.id]) {
                        entries.push({ id: g.id, name: g.name, type: 'group', checked: selected.indexOf(g.id) !== -1 });
                    }
                });
                const users = (data.users && data.users.visibles) || [];
                const uChecked = (data.users && data.users.checked) || {};
                users.forEach((u) => {
                    if (uChecked[u.id]) {
                        const name = u.username || ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
                        entries.push({ id: u.id, name: name, type: 'user', checked: selected.indexOf(u.id) !== -1 });
                    }
                });
                $scope.pageRights.entries = entries;
            } catch (e) {
                notify.error('pages.rights.load.error');
            }
            $scope.pageRights.loading = false;
            $scope.$apply();
        };

        $scope.savePageRights = async () => {
            const page: Page = $scope.pageRights.page;
            if (!page) { return; }
            const contrib = $scope.pageRights.entries.filter((e) => e.checked).map((e) => e.id);
            try {
                await http.put('/pages/' + $scope.website._id + '/page/' + page.titleLink + '/rights', { contrib: contrib });
                page.contrib = contrib;
                notify.info('pages.rights.saved');
            } catch (e) {
                notify.error('pages.rights.save.error');
            }
            $scope.closeLightbox('pageRights');
            $scope.$apply();
        };

        $scope.closeCellTitle = (save: boolean) => {
            if(save){
                $scope.display.data.title = $scope.display.data.newTitle;
            }
            delete $scope.display.data.newTitle;
            $scope.lightbox('setCellTitle');
        };

        $scope.confirmRemoveCell = () => {
            $scope.display.data.row.removeCell($scope.display.data.cell);
            $scope.lightbox('confirmRemoveCell');
        }

        $scope.applyHtml = (cell) => {
            $scope.page.eventer.trigger('save');
            cell.media.showEmbedder = false;
        }
}])